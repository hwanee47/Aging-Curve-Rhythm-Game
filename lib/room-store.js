import roomModule from '../rooms.js';
import redisModule from './redis-room-store.js';

const { RoomStore } = roomModule;
const { RedisRoomStore, createRedisCommand } = redisModule;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const unavailableStore = new Proxy({}, {
  get() {
    return () => { throw new Error('함께하기 저장소가 연결되지 않았습니다. Vercel에 Upstash Redis를 연결해 주세요.'); };
  },
});

// Vercel functions do not share process memory. Use Redis for every room request there.
export const roomStore = redisUrl && redisToken
  ? new RedisRoomStore({ command: createRedisCommand(redisUrl, redisToken) })
  : process.env.VERCEL || process.env.VERCEL_ENV
    ? unavailableStore
    : globalThis.__agingCurveRoomStore ??= new RoomStore();
