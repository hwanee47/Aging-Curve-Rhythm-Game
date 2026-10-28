import { roomStore } from '../../../lib/room-store';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const data = await request.json();
    return Response.json(await roomStore.create(data.name), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
