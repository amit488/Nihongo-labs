import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getReadingPassageById } from '@/lib/nihongo/reading-content';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { requireUser } from '@/lib/nihongo/server/supabase';

const progressSchema = z.object({
  passageId: z.string().regex(/^[a-z0-9-]{3,80}$/),
  level: z.enum(['N5', 'N4']),
}).strict();

function parseLevel(value: string | null): 'N5' | 'N4' {
  if (value !== 'N5' && value !== 'N4') throw new HttpError(400, 'Unsupported JLPT level.');
  return value;
}

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const level = parseLevel(request.nextUrl.searchParams.get('level'));
    const { data, error } = await context.supabase
      .from('user_reading_progress')
      .select('passage_id')
      .eq('user_id', context.user.id)
      .eq('jlpt_level', level)
      .order('learned_at', { ascending: false })
      .limit(500);
    if (error) throw new HttpError(500, 'Could not load learned readings.', error.message);
    return NextResponse.json(
      { passageIds: (data ?? []).map((row) => row.passage_id) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, progressSchema);
    if (!getReadingPassageById(input.passageId, input.level)) {
      throw new HttpError(404, 'Reading passage not found.');
    }
    const { error } = await context.supabase.from('user_reading_progress').insert({
      user_id: context.user.id,
      passage_id: input.passageId,
      jlpt_level: input.level,
    });
    if (error && error.code !== '23505') {
      throw new HttpError(500, 'Could not mark this reading as learned.', error.message);
    }
    return NextResponse.json({ learned: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, progressSchema);
    const { error } = await context.supabase.from('user_reading_progress')
      .delete()
      .eq('user_id', context.user.id)
      .eq('passage_id', input.passageId)
      .eq('jlpt_level', input.level);
    if (error) throw new HttpError(500, 'Could not remove this learned reading.', error.message);
    return NextResponse.json({ learned: false });
  } catch (error) {
    return jsonError(error);
  }
}
