import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type VocabularyQueueRow = {
  item: Record<string, unknown> | null;
  total_due: number | string;
  total_unreviewed: number | string;
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || 30);
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 30;
    const level = (request.nextUrl.searchParams.get('level') || 'N5').toUpperCase();
    if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(level)) {
      throw new HttpError(400, 'Unsupported JLPT level.');
    }

    const { data, error } = await context.supabase.rpc('get_due_vocabulary', {
      _level: level,
      _limit: limit,
    });
    if (error) throw new HttpError(500, 'Could not load vocabulary revision queue.', error.message);

    const rows = (data ?? []) as VocabularyQueueRow[];
    return NextResponse.json({
      items: rows.flatMap((row) => row.item ? [row.item] : []),
      dueCount: Number(rows[0]?.total_due ?? 0),
      totalUnreviewed: Number(rows[0]?.total_unreviewed ?? 0),
      level,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
