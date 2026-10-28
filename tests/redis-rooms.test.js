const { test } = require('node:test');
const assert = require('node:assert/strict');

test('서로 다른 서버 인스턴스에서도 방을 찾고 다음 판까지 참가자를 유지한다', async () => {
  const { RedisRoomStore } = require('../lib/redis-room-store.js');
  const data = new Map();
  const command = async (...args) => {
    const [name, ...values] = args;
    const key = values[0];
    if (name === 'GET') return data.get(key) ?? null;
    if (name === 'SET') {
      if (values[2] === 'NX' && data.has(key)) return null;
      data.set(key, values[1]);
      return 'OK';
    }
    if (name === 'SCAN') return ['0', [...data.keys()].filter(value => value.startsWith('aging-curve:room:'))];
    if (name === 'MGET') return values.map(value => data.get(value) ?? null);
    if (name === 'EVAL') {
      const [script, , target, expected, replacement] = values;
      if (data.get(target) !== expected) return 0;
      if (script.includes("redis.call('DEL'")) data.delete(target);
      else data.set(target, replacement);
      return 1;
    }
    throw new Error(`지원하지 않는 명령: ${name}`);
  };
  let now = 1000;
  const hostServer = new RedisRoomStore({ command, now: () => now });
  const guestServer = new RedisRoomStore({ command, now: () => now });
  const host = await hostServer.create('방장');
  now += 60_000;
  const guest = await guestServer.join(host.code, '참가자');
  assert.deepEqual(guest.snapshot.players.map(player => player.name), ['방장', '참가자']);
  assert.deepEqual((await hostServer.listWaiting()).map(room => room.code), [host.code]);
  await guestServer.start(host.code, host.playerId);
  assert.deepEqual(await hostServer.listWaiting(), []);
  now += 4000;
  await Promise.all([
    hostServer.progress(host.code, host.playerId, { round: 1, score: 5000, progress: 100, finished: true }),
    guestServer.progress(host.code, guest.playerId, { round: 1, score: 4000, progress: 100 }),
  ]);
  const final = await hostServer.getSnapshot(host.code, host.playerId);
  assert.equal(final.status, 'finished');
  assert.equal(final.players.length, 2);
  const next = await guestServer.replay(host.code, host.playerId);
  assert.equal(next.status, 'lobby');
  assert.equal(next.round, 2);
  assert.deepEqual(next.players.map(player => player.name), ['방장', '참가자']);
  assert.deepEqual((await hostServer.listWaiting()).map(room => room.code), [host.code]);
});
