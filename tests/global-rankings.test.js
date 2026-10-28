const { test } = require('node:test');
const assert = require('node:assert/strict');

test('서로 다른 인스턴스의 혼자하기와 함께하기 기록이 난이도별 전체 랭킹에 공유된다', async () => {
  const { GlobalRankingStore, createMemoryRankingCommand } = require('../lib/global-ranking-store.js');
  const command = createMemoryRankingCommand();
  const first = new GlobalRankingStore({ command, now: () => 1000 });
  const second = new GlobalRankingStore({ command, now: () => 2000 });
  const solo = await first.save({ id: 'solo-1', name: '첫째', mode: 'solo', difficulty: 'normal', score: 1200, accuracy: 90 });
  assert.equal(solo.rank, 1);
  const together = await second.save({ id: 'room-1', name: '둘째', mode: 'together', difficulty: 'normal', score: 1500, accuracy: 95 });
  assert.equal(together.rank, 1);
  assert.deepEqual((await first.list('normal')).map(row => row.name), ['둘째', '첫째']);
  assert.equal((await second.list('easy')).length, 0);
  await first.save({ id: 'room-1', name: '둘째', mode: 'together', difficulty: 'normal', score: 1500, accuracy: 95 });
  assert.equal((await second.list('normal')).length, 2);
});
