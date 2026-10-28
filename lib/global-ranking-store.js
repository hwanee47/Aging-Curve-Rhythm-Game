const DIFFICULTIES = new Set(['easy', 'normal', 'hard', 'superhard']);
const MODES = new Set(['solo', 'together']);
const SAVE_IF_UNCHANGED = "if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET', KEYS[1], ARGV[2]) return 1";

function normalizeRecord(input, now) {
  const difficulty = String(input.difficulty || '');
  const mode = String(input.mode || '');
  const name = String(input.name || '').trim().replace(/\s+/g, ' ').slice(0, 12);
  const id = String(input.id || '').slice(0, 120);
  const score = Number(input.score);
  const accuracy = Number(input.accuracy);
  if (!DIFFICULTIES.has(difficulty)) throw new Error('난이도를 확인해 주세요.');
  if (!MODES.has(mode)) throw new Error('플레이 모드를 확인해 주세요.');
  if (!name || !id) throw new Error('랭킹 기록을 확인해 주세요.');
  if (!Number.isInteger(score) || score < 0 || score > 1_000_000) throw new Error('점수를 확인해 주세요.');
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) throw new Error('정확도를 확인해 주세요.');
  return { id, name, mode, difficulty, score, accuracy, at: now };
}

class GlobalRankingStore {
  constructor({ command, now = Date.now }) {
    this.command = command;
    this.now = now;
  }

  key(difficulty) {
    if (!DIFFICULTIES.has(difficulty)) throw new Error('난이도를 확인해 주세요.');
    return `aging-curve:ranking:${difficulty}`;
  }

  async list(difficulty) {
    const raw = await this.command('GET', this.key(difficulty));
    return raw ? JSON.parse(raw) : [];
  }

  async save(input) {
    const entry = normalizeRecord(input, this.now());
    const key = this.key(entry.difficulty);
    await this.command('SET', key, '[]', 'NX');
    for (let attempt = 0; attempt < 12; attempt++) {
      const original = await this.command('GET', key);
      const rows = JSON.parse(original);
      const existing = rows.findIndex(row => row.id === entry.id);
      if (existing >= 0) return { rows: rows.slice(0, 10), rank: existing + 1, entry: rows[existing] };
      const updated = [...rows, entry]
        .sort((a, b) => b.score - a.score || b.accuracy - a.accuracy || a.at - b.at || a.id.localeCompare(b.id))
        .slice(0, 500);
      const saved = await this.command('EVAL', SAVE_IF_UNCHANGED, 1, key, original, JSON.stringify(updated));
      if (Number(saved) === 1) {
        const index = updated.findIndex(row => row.id === entry.id);
        return { rows: updated.slice(0, 10), rank: index >= 0 ? index + 1 : null, entry };
      }
    }
    throw new Error('랭킹이 동시에 변경됐습니다. 다시 시도해 주세요.');
  }
}

function createMemoryRankingCommand() {
  const data = new Map();
  return async (name, ...args) => {
    if (name === 'GET') return data.get(args[0]) ?? null;
    if (name === 'SET') {
      if (args[2] === 'NX' && data.has(args[0])) return null;
      data.set(args[0], args[1]);
      return 'OK';
    }
    if (name === 'EVAL') {
      const [, , key, expected, replacement] = args;
      if (data.get(key) !== expected) return 0;
      data.set(key, replacement);
      return 1;
    }
    throw new Error('지원하지 않는 랭킹 명령입니다.');
  };
}

module.exports = { GlobalRankingStore, createMemoryRankingCommand };
