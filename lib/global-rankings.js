import rankingModule from './global-ranking-store.js';
import redisModule from './redis-room-store.js';

const { GlobalRankingStore, createMemoryRankingCommand } = rankingModule;
const { createRedisCommand } = redisModule;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const command = redisUrl && redisToken
  ? createRedisCommand(redisUrl, redisToken)
  : process.env.VERCEL || process.env.VERCEL_ENV
    ? async () => { throw new Error('전체 랭킹 저장소가 연결되지 않았습니다. Vercel에 Upstash Redis를 연결해 주세요.'); }
    : globalThis.__agingCurveRankingCommand ??= createMemoryRankingCommand();

export const globalRankingStore = new GlobalRankingStore({ command });
