import { roomStore } from '../../../../../lib/room-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { code, action } = await context.params;
  if (!/^\d{6}$/.test(code) || action !== 'snapshot') return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  const token = new URL(request.url).searchParams.get('playerId');
  try {
    return Response.json(await roomStore.getSnapshot(code, token), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request, context) {
  const { code, action } = await context.params;
  if (!/^\d{6}$/.test(code)) return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  try {
    const data = await request.json();
    let result;
    if (action === 'join') result = await roomStore.join(code, data.name);
    else if (action === 'settings') result = await roomStore.settings(code, data.playerId, data);
    else if (action === 'start') result = await roomStore.start(code, data.playerId);
    else if (action === 'replay') result = await roomStore.replay(code, data.playerId);
    else if (action === 'progress') result = await roomStore.progress(code, data.playerId, data);
    else if (action === 'leave') result = await roomStore.leave(code, data.playerId);
    else return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
