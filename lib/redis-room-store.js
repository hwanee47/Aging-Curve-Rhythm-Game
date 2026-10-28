const { RoomStore, waitingRooms } = require('../rooms.js');

const SAVE_IF_UNCHANGED = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[1], ARGV[2]) return 1";
const DELETE_IF_UNCHANGED = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('DEL', KEYS[1]) return 1";

class RedisRoomStore {
  constructor({ command, now = Date.now }) {
    this.command = command;
    this.now = now;
  }

  key(code) {
    return `aging-curve:room:${code}`;
  }

  read(raw) {
    if (raw == null) throw new Error('방을 찾을 수 없습니다. 방번호를 확인해 주세요.');
    const room = JSON.parse(raw);
    room.listeners = new Set();
    const store = new RoomStore({ now: this.now });
    store.rooms.set(room.code, room);
    return store;
  }

  async create(name) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const store = new RoomStore({ now: this.now });
      const result = store.create(name);
      const saved = await this.command('SET', this.key(result.code), JSON.stringify(store.room(result.code)), 'NX');
      if (saved === 'OK') return result;
    }
    throw new Error('방번호를 만들 수 없습니다. 다시 시도해 주세요.');
  }

  async getSnapshot(code, token) {
    const store = this.read(await this.command('GET', this.key(code)));
    const room = store.room(code);
    store.player(room, token);
    return store.snapshot(room);
  }

  async listWaiting() {
    const rooms = new Map();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.command('SCAN', cursor, 'MATCH', 'aging-curve:room:*', 'COUNT', 100);
      cursor = String(nextCursor);
      if (keys.length) {
        const values = await this.command('MGET', ...keys);
        for (const raw of values) {
          if (!raw) continue;
          const room = JSON.parse(raw);
          rooms.set(room.code, room);
        }
      }
    } while (cursor !== '0');
    return waitingRooms(rooms.values());
  }

  async change(code, action, ...args) {
    const key = this.key(code);
    for (let attempt = 0; attempt < 12; attempt++) {
      const original = await this.command('GET', key);
      const store = this.read(original);
      const result = store[action](code, ...args);
      const room = store.rooms.get(String(code));
      const saved = room
        ? await this.command('EVAL', SAVE_IF_UNCHANGED, 1, key, original, JSON.stringify(room))
        : await this.command('EVAL', DELETE_IF_UNCHANGED, 1, key, original);
      if (Number(saved) === 1) return result;
    }
    throw new Error('방 상태가 동시에 변경됐습니다. 다시 시도해 주세요.');
  }

  join(code, name) { return this.change(code, 'join', name); }
  settings(code, token, data) { return this.change(code, 'settings', token, data); }
  start(code, token) { return this.change(code, 'start', token); }
  replay(code, token) { return this.change(code, 'replay', token); }
  progress(code, token, data) { return this.change(code, 'progress', token, data); }
  leave(code, token) { return this.change(code, 'leave', token); }
}

function createRedisCommand(url, token) {
  return async (...args) => {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        cache: 'no-store',
      });
    } catch {
      throw new Error('방 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    }
    const data = await response.json();
    if (!response.ok || data.error) throw new Error('방 저장소 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return data.result;
  };
}

module.exports = { RedisRoomStore, createRedisCommand };
