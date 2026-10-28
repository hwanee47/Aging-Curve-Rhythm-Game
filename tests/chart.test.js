const { test } = require('node:test');
const assert = require('node:assert/strict');

test('네 난이도의 노트는 시간순이고 각 레인 범위 안에 있다', async () => {
  const { buildChart, SONG } = await import('../src/chart.mjs');
  const levels = [['easy',4],['normal',4],['hard',7],['superhard',7]];
  const charts = levels.map(([level])=>buildChart(level));
  assert.ok(charts[0].length < charts[1].length && charts[1].length < charts[2].length && charts[2].length < charts[3].length);
  for (const [index,notes] of charts.entries()) {
    const lanes=levels[index][1];
    assert.ok(notes.every(n => n.lane >= 0 && n.lane < lanes && n.t >= 0 && n.t < SONG.duration));
    assert.ok(notes.every((n, i) => i === 0 || n.t >= notes[i - 1].t));
    assert.deepEqual(new Set(notes.map(n => n.lane)), new Set(Array.from({length:lanes},(_,lane)=>lane)));
  }
});

test('가장 가까운 같은 레인 노트만 판정한다', async () => {
  const { findHit, judgeOffset } = await import('../src/chart.mjs');
  const notes = [{ lane: 0, t: 1, hit: false }, { lane: 1, t: 1.01, hit: false }, { lane: 0, t: 1.15, hit: false }];
  assert.equal(findHit(notes, 0, 1.13), 2);
  assert.equal(findHit(notes, 1, 1.13), 1);
  assert.equal(findHit(notes, 2, 1.13), -1);
  assert.equal(judgeOffset(.03), 'PERFECT');
  assert.equal(judgeOffset(.09), 'GREAT');
  assert.equal(judgeOffset(.15), 'GOOD');
  assert.equal(judgeOffset(.22), null);
});

test('모든 난이도에 롱노트가 있고 같은 레인 노트와 겹치지 않는다', async () => {
  const { buildChart, SONG } = await import('../src/chart.mjs');
  for (const level of ['easy', 'normal', 'hard', 'superhard']) {
    const notes = buildChart(level);
    const holds = notes.filter(note => note.endT);
    assert.ok(holds.length >= 6);
    for (const hold of holds) {
      assert.ok(hold.endT > hold.t && hold.endT < SONG.duration);
      assert.ok(!notes.some(note => note !== hold && note.lane === hold.lane && note.t > hold.t && note.t <= hold.endT));
    }
  }
});

test('롱노트는 끝까지 누르면 성공하고 일찍 떼면 실패한다', async () => {
  const { holdResult } = await import('../src/chart.mjs');
  const note = { holding: true, endT: 3, hit: false, missed: false };
  assert.equal(holdResult(note, 2.5, true), null);
  assert.equal(holdResult(note, 3, true), 'complete');
  assert.equal(holdResult(note, 2.5, false), 'miss');
  assert.equal(holdResult(note, 2.95, false), 'complete');
});
