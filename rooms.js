const { randomInt, randomUUID } = require('node:crypto');

const DIFFICULTIES = new Set(['easy', 'normal', 'hard', 'superhard']);
const SPEEDS = new Set([1, 1.25, 1.5, 1.75, 2]);

class RoomStore {
  constructor({ now = Date.now } = {}) {
    this.now = now;
    this.rooms = new Map();
  }

  room(code) {
    const room = this.rooms.get(String(code));
    if (!room) throw new Error('방을 찾을 수 없습니다. 방번호를 확인해 주세요.');
    return room;
  }

  player(room, token) {
    const player = room.players.find(entry => entry.token === token);
    if (!player) throw new Error('방 참가 정보를 확인할 수 없습니다.');
    return player;
  }

  snapshot(room) {
    const status = room.status === 'countdown' && this.now() >= room.startsAt ? 'playing' : room.status;
    const finished = status === 'playing' && room.players.length && room.players.every(player => player.finished);
    return {
      code: room.code,
      round: room.round,
      status: finished ? 'finished' : status,
      hostId: room.hostId,
      difficulty: room.difficulty,
      speed: room.speed,
      startsAt: room.startsAt,
      serverNow: this.now(),
      players: room.players.map(({ id, name, score, combo, accuracy, progress, finished }) => ({ id, name, score, combo, accuracy, progress, finished })),
    };
  }

  notify(room) {
    const snapshot = this.snapshot(room);
    for (const listener of room.listeners) listener(snapshot);
    return snapshot;
  }

  create(name) {
    const cleanName = String(name || '').trim().slice(0, 12);
    if (!cleanName) throw new Error('플레이어 이름을 입력해 주세요.');
    let code;
    do { code = String(randomInt(0, 1000000)).padStart(6, '0'); } while (this.rooms.has(code));
    const player = { id: randomUUID(), token: randomUUID(), name: cleanName, score: 0, combo: 0, accuracy: 100, progress: 0, finished: false };
    const room = { code, round: 1, status: 'lobby', difficulty: 'normal', speed: 1, startsAt: null, hostId: player.id, players: [player], listeners: new Set() };
    this.rooms.set(code, room);
    return { code, playerId: player.token, selfId: player.id, snapshot: this.snapshot(room) };
  }

  join(code, name) {
    const room = this.room(code);
    if (room.status !== 'lobby') throw new Error('이미 시작한 방입니다.');
    if (room.players.length >= 8) throw new Error('방이 가득 찼습니다.');
    const cleanName = String(name || '').trim().slice(0, 12);
    if (!cleanName) throw new Error('플레이어 이름을 입력해 주세요.');
    const player = { id: randomUUID(), token: randomUUID(), name: cleanName, score: 0, combo: 0, accuracy: 100, progress: 0, finished: false };
    room.players.push(player);
    const snapshot = this.notify(room);
    return { code: room.code, playerId: player.token, selfId: player.id, snapshot };
  }

  settings(code, token, { difficulty, speed }) {
    const room = this.room(code);
    if (this.player(room, token).id !== room.hostId) throw new Error('방장만 설정을 바꿀 수 있습니다.');
    if (room.status !== 'lobby') throw new Error('게임 시작 후에는 설정을 바꿀 수 없습니다.');
    if (!DIFFICULTIES.has(difficulty)) throw new Error('난이도를 확인해 주세요.');
    if (!SPEEDS.has(Number(speed))) throw new Error('속도를 확인해 주세요.');
    room.difficulty = difficulty;
    room.speed = Number(speed);
    return this.notify(room);
  }

  start(code, token) {
    const room = this.room(code);
    if (this.player(room, token).id !== room.hostId) throw new Error('방장만 시작할 수 있습니다.');
    if (room.status !== 'lobby') throw new Error('이미 시작한 방입니다.');
    room.status = 'countdown';
    room.startsAt = this.now() + 3000;
    return this.notify(room);
  }

  replay(code, token) {
    const room = this.room(code);
    if (this.player(room, token).id !== room.hostId) throw new Error('방장만 다시 시작할 수 있습니다.');
    if (this.snapshot(room).status !== 'finished') throw new Error('모든 참가자의 게임이 끝나야 다시 시작할 수 있습니다.');
    room.round++;
    room.status = 'lobby';
    room.startsAt = null;
    for (const player of room.players) {
      player.score = 0;
      player.combo = 0;
      player.accuracy = 100;
      player.progress = 0;
      player.finished = false;
    }
    return this.notify(room);
  }

  progress(code, token, data) {
    const room = this.room(code);
    const player = this.player(room, token);
    if (Number(data.round) !== room.round) throw new Error('이전 판의 진행 상황입니다.');
    if (room.status === 'lobby') throw new Error('게임이 아직 시작되지 않았습니다.');
    if (player.finished && !data.finished) return this.snapshot(room);
    player.score = Math.max(player.score, Math.floor(Number(data.score) || 0));
    player.combo = Math.max(0, Math.floor(Number(data.combo) || 0));
    player.accuracy = Math.max(0, Math.min(100, Number(data.accuracy) || 0));
    player.progress = Math.max(player.progress, Math.min(100, Number(data.progress) || 0));
    player.finished = player.finished || Boolean(data.finished) || player.progress >= 100;
    return this.notify(room);
  }

  leave(code, token) {
    const room = this.room(code);
    const player = this.player(room, token);
    room.players = room.players.filter(entry => entry !== player);
    if (!room.players.length) { this.rooms.delete(room.code); return null; }
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    return this.notify(room);
  }

  subscribe(code, token, listener) {
    const room = this.room(code);
    this.player(room, token);
    room.listeners.add(listener);
    listener(this.snapshot(room));
    return () => room.listeners.delete(listener);
  }
}

module.exports = { RoomStore, SPEEDS };
