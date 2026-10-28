import roomModule from '../rooms.js';

const { RoomStore } = roomModule;

// Keep one store across Next.js route modules in a local Node process.
export const roomStore = globalThis.__agingCurveRoomStore ??= new RoomStore();
