const { test } = require('node:test');
const assert = require('node:assert/strict');

test('이지와 노말은 4레인, 하드와 슈퍼 하드는 7레인 키를 쓴다', async () => {
  const { laneForCode, keyLabelsForDifficulty, isPauseCode } = await import('../src/rules.mjs');
  assert.deepEqual(keyLabelsForDifficulty('easy'),['S','D','J','K']);
  assert.deepEqual(keyLabelsForDifficulty('normal'),['S','D','J','K']);
  assert.deepEqual(keyLabelsForDifficulty('hard'),['S','D','F','SPACE','H','J','K']);
  assert.deepEqual(keyLabelsForDifficulty('superhard'),['S','D','F','SPACE','H','J','K']);
  assert.deepEqual(['KeyS','KeyD','KeyJ','KeyK'].map(code=>laneForCode(code,'normal')),[0,1,2,3]);
  assert.deepEqual(['KeyS','KeyD','KeyF','Space','KeyH','KeyJ','KeyK'].map(code=>laneForCode(code,'superhard')),[0,1,2,3,4,5,6]);
  assert.equal(laneForCode('Space','normal'),-1);
  assert.equal(isPauseCode('KeyP'),true);
});

test('이름을 정리하고 랭킹을 점수순으로 최대 10명 보관한다', async () => {
  const { normalizeName, insertRanking } = await import('../src/rules.mjs');
  assert.equal(normalizeName('  네온 플레이어  '),'네온 플레이어');
  assert.equal(normalizeName(' '.repeat(20)),'');
  assert.ok(normalizeName('가'.repeat(30)).length <= 12);
  const rows = Array.from({length:10},(_,i)=>({name:`유저${i}`,score:100+i,accuracy:70,at:i}));
  const next=insertRanking(rows,{name:'새유저',score:999,accuracy:98,at:11});
  assert.equal(next.length,10);
  assert.equal(next[0].name,'새유저');
  assert.ok(next.every((row,i)=>i===0||row.score<=next[i-1].score));
});
