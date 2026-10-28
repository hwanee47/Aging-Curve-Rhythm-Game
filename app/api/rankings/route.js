import { globalRankingStore } from '../../../lib/global-rankings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const difficulty = new URL(request.url).searchParams.get('difficulty');
    return Response.json({ rows: (await globalRankingStore.list(difficulty)).slice(0, 10) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request) {
  try {
    const entry = await request.json();
    return Response.json(await globalRankingStore.save(entry), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
