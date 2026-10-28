const { test } = require('node:test');
const assert = require('node:assert/strict');

test('방장은 설정과 시작을 관리하고 참가자는 같은 방의 진행 상황을 본다', () => {
  const { RoomStore } = require('../rooms.js');
  let now = 1000;
  const store = new RoomStore({ now: () => now });
  const host = store.create('방장');
  assert.match(host.code, /^\d{6}$/);
  const guest = store.join(host.code, '친구');
  assert.equal(guest.snapshot.players.length, 2);
  assert.throws(() => store.settings(host.code, guest.playerId, { difficulty: 'hard', speed: 1.5 }), /방장/);
  const configured = store.settings(host.code, host.playerId, { difficulty: 'hard', speed: 1.5 });
  assert.equal(configured.difficulty, 'hard');
  assert.equal(configured.speed, 1.5);
  assert.throws(() => store.start(host.code, guest.playerId), /방장/);
  const started = store.start(host.code, host.playerId);
  assert.equal(started.status, 'countdown');
  assert.equal(started.startsAt, 4000);
  assert.throws(() => store.join(host.code, '늦은 친구'), /시작/);
  now = 4500;
  const progress = store.progress(host.code, guest.playerId, { round: 1, score: 2500, progress: 42, combo: 5, accuracy: 95 });
  assert.equal(progress.players.find(player => player.name === '친구').score, 2500);
  assert.equal(progress.players.find(player => player.name === '친구').progress, 42);
});

test('방장은 유효한 속도만 설정하고 방을 떠나면 다음 참가자에게 방장이 넘어간다', () => {
  const { RoomStore } = require('../rooms.js');
  const store = new RoomStore();
  const host = store.create('첫 번째');
  const guest = store.join(host.code, '두 번째');
  assert.throws(() => store.settings(host.code, host.playerId, { difficulty: 'normal', speed: 9 }), /속도/);
  const left = store.leave(host.code, host.playerId);
  assert.equal(left.hostId, guest.snapshot.players.find(player => player.name === '두 번째').id);
  assert.equal(left.players.length, 1);
});

test('같은 방의 최종 점수는 늦게 도착한 진행 상황으로 덮이지 않는다', () => {
  const { RoomStore } = require('../rooms.js');
  let now = 1000;
  const store = new RoomStore({ now: () => now });
  const host = store.create('방장');
  const guest = store.join(host.code, '참가자');
  store.start(host.code, host.playerId);
  now = 4500;
  store.progress(host.code, host.playerId, { round: 1, score: 5000, progress: 100, finished: true });
  store.progress(host.code, host.playerId, { round: 1, score: 3000, progress: 80, finished: false });
  const final = store.progress(host.code, guest.playerId, { round: 1, score: 4200, progress: 100, finished: true });
  assert.equal(final.status, 'finished');
  assert.equal(final.players.find(player => player.name === '방장').score, 5000);
  assert.equal(final.players.find(player => player.name === '방장').progress, 100);
  assert.equal(final.players.find(player => player.name === '참가자').score, 4200);
});

test('다시하기는 방번호와 참가자를 유지하고 다음 판 점수만 초기화한다', () => {
  const { RoomStore } = require('../rooms.js');
  let now = 1000;
  const store = new RoomStore({ now: () => now });
  const host = store.create('방장');
  const guest = store.join(host.code, '참가자');
  store.start(host.code, host.playerId);
  now = 4500;
  store.progress(host.code, host.playerId, { round: 1, score: 5000, progress: 100, finished: true });
  assert.throws(() => store.replay(host.code, host.playerId), /모든 참가자/);
  store.progress(host.code, guest.playerId, { round: 1, score: 4200, progress: 100, finished: true });
  assert.throws(() => store.replay(host.code, guest.playerId), /방장/);
  const next = store.replay(host.code, host.playerId);
  assert.equal(next.code, host.code);
  assert.equal(next.round, 2);
  assert.equal(next.status, 'lobby');
  assert.equal(next.players.length, 2);
  assert.deepEqual(next.players.map(player => player.name), ['방장', '참가자']);
  assert.ok(next.players.every(player => player.score === 0 && player.progress === 0 && !player.finished));
  assert.throws(() => store.progress(host.code, guest.playerId, { round: 1, score: 9999 }), /이전 판/);
  const restarted = store.start(host.code, host.playerId);
  assert.equal(restarted.round, 2);
  assert.equal(restarted.status, 'countdown');
});
