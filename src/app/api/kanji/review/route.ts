import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { z } from 'zod';

// Authenticated routes read request cookies and must not be prerendered.
export const dynamic = 'force-dynamic';

const schema = z.object({
  kanjiId: z.string().uuid(),
  status: z.enum(['known', 'learning']),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, schema);
    const { data: kanji, error: kanjiError } = await context.supabase
      .from('kanji_entries').select('id').eq('id', input.kanjiId)
      .eq('publication_status', 'published').maybeSingle();
    if (kanjiError || !kanji) throw new HttpError(404, 'Kanji card not found.');
    const now = new Date();
    const intervalDays = input.status === 'known' ? 3 : 0;
    const dueAt = new Date(now.getTime() + intervalDays * 86400000).toISOString();
    const { data, error } = await context.supabase.from('kanji_review_state').upsert({
      user_id: context.user.id,
      kanji_id: input.kanjiId,
      status: input.status,
      repetitions: input.status === 'known' ? 1 : 0,
      interval_days: intervalDays,
      due_at: dueAt,
      last_reviewed_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id,kanji_id' }).select('kanji_id,status,repetitions,interval_days,due_at,last_reviewed_at').single();
    if (error) throw new HttpError(500, 'Could not save kanji progress.', error.message);
    return NextResponse.json({ progress: data });
  } catch (error) { return jsonError(error); }
}
