import { roomStore } from '../../../../../lib/room-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  const { code, action } = await context.params;
  if (!/^\d{6}$/.test(code) || action !== 'events') return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  const token = new URL(request.url).searchParams.get('playerId');
  try {
    roomStore.player(roomStore.room(code), token);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let unsubscribe;
  let heartbeat;
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        try { controller.close(); } catch { /* Connection already closed. */ }
      };
      unsubscribe = roomStore.subscribe(code, token, snapshot => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
      });
      heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);
      request.signal.addEventListener('abort', close, { once: true });
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe?.();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request, context) {
  const { code, action } = await context.params;
  if (!/^\d{6}$/.test(code)) return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
  try {
    const data = await request.json();
    let result;
    if (action === 'join') result = roomStore.join(code, data.name);
    else if (action === 'settings') result = roomStore.settings(code, data.playerId, data);
    else if (action === 'start') result = roomStore.start(code, data.playerId);
    else if (action === 'replay') result = roomStore.replay(code, data.playerId);
    else if (action === 'progress') result = roomStore.progress(code, data.playerId, data);
    else if (action === 'leave') result = roomStore.leave(code, data.playerId);
    else return Response.json({ error: '요청을 찾을 수 없습니다.' }, { status: 404 });
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
