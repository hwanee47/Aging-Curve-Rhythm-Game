import { roomStore } from '../../../../lib/room-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return Response.json({ rooms: await roomStore.listWaiting() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
