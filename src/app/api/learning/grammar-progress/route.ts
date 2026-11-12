import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { z } from 'zod';

const progressSchema = z.object({ grammarId: z.string().uuid() }).strict();

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const level = request.nextUrl.searchParams.get('level') || 'N5';
    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');

    const { data, error } = await context.supabase
      .from('user_grammar_progress')
      .select('grammar_id,grammar_points!inner(jlpt_level,publication_status)')
      .eq('user_id', context.user.id)
      .eq('grammar_points.jlpt_level', level)
      .eq('grammar_points.publication_status', 'published')
      .limit(1000);
    if (error) throw new HttpError(500, 'Could not load understood grammar.', error.message);

    return NextResponse.json(
      { grammarIds: (data ?? []).map((row) => row.grammar_id) },
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

    const { data: grammar, error: grammarError } = await context.supabase
      .from('grammar_points').select('id')
      .eq('id', input.grammarId).eq('publication_status', 'published').maybeSingle();
    if (grammarError || !grammar) throw new HttpError(404, 'Grammar point not found or unavailable.');

    const { error } = await context.supabase.from('user_grammar_progress')
      .upsert(
        { user_id: context.user.id, grammar_id: input.grammarId },
        { onConflict: 'user_id,grammar_id', ignoreDuplicates: true },
      );
    if (error) throw new HttpError(500, 'Could not mark grammar as understood.', error.message);

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

    const { error } = await context.supabase.from('user_grammar_progress')
      .delete().eq('user_id', context.user.id).eq('grammar_id', input.grammarId);
    if (error) throw new HttpError(500, 'Could not remove grammar from learned items.', error.message);

    return NextResponse.json({ learned: false });
  } catch (error) {
    return jsonError(error);
  }
}
