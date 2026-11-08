import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { vocabularyProgressSchema } from '@/lib/nihongo/server/validation';

type LearnedVocabularyRow = {
  vocabulary_id: string;
  learned_at: string;
  vocabulary_entries: {
    word: string;
    kana: string;
    romaji: string | null;
    meaning: string;
    jlpt_level: string;
  } | null;
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const params = request.nextUrl.searchParams;
    const level = params.get('level') || 'N5';
    const view = params.get('view') || 'ids';
    const defaultLimit = view === 'ids' ? 1000 : 500;
    const maxLimit = view === 'ids' ? 1000 : 500;
    const rawLimit = Number(params.get('limit') || defaultLimit);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(maxLimit, Math.max(1, Math.floor(rawLimit)))
      : defaultLimit;
    const rawOffset = Number(params.get('offset') || 0);
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    const rawSearch = params.get('q')?.trim() ?? '';
    const search = rawSearch.replace(/[(),%_]/g, ' ').replace(/\\s+/g, ' ').slice(0, 80).trim();

    if (!['N5', 'N4'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');
    if (!['ids', 'learned'].includes(view)) throw new HttpError(400, 'Unsupported vocabulary progress view.');

    const selection = view === 'ids'
      ? 'vocabulary_id,vocabulary_entries!inner(jlpt_level,publication_status)'
      : 'vocabulary_id,learned_at,vocabulary_entries!inner(word,kana,romaji,meaning,jlpt_level,publication_status)';

    let query = context.supabase.from('user_vocabulary_progress')
      .select(selection, { count: 'exact' })
      .eq('user_id', context.user.id)
      .eq('vocabulary_entries.jlpt_level', level)
      .eq('vocabulary_entries.publication_status', 'published')
      .order(view === 'ids' ? 'vocabulary_id' : 'learned_at', { ascending: view === 'ids' });

    if (view === 'learned' && search) {
      query = query.or(
        `word.ilike.%${search}%,kana.ilike.%${search}%,meaning.ilike.%${search}%`,
        { referencedTable: 'vocabulary_entries' },
      );
    }

    const { data, error, count } = view === 'ids'
      ? await query.range(0, limit - 1)
      : await query.range(offset, offset + limit);

    if (error) throw new HttpError(500, 'Could not load learned vocabulary.', error.message);

    if (view === 'ids') {
      const rows = (data ?? []) as unknown as Array<{ vocabulary_id: string }>;
      return NextResponse.json(
        { vocabularyIds: rows.map((row) => row.vocabulary_id), count: count ?? rows.length },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const rows = (data ?? []) as unknown as LearnedVocabularyRow[];
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).flatMap((row) => {
      const word = row.vocabulary_entries;
      return word ? [{
        vocabularyId: row.vocabulary_id,
        learnedAt: row.learned_at,
        word: word.word,
        kana: word.kana,
        romaji: word.romaji || '',
        meaning: word.meaning,
      }] : [];
    });

    return NextResponse.json(
      { items, hasMore, nextOffset: offset + items.length, count: count ?? items.length },
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
    const input = await readJson(request, vocabularyProgressSchema);

    const { data: vocabulary, error: vocabularyError } = await context.supabase
      .from('vocabulary_entries')
      .select('id')
      .eq('id', input.vocabularyId)
      .eq('publication_status', 'published')
      .maybeSingle();
    if (vocabularyError || !vocabulary) throw new HttpError(404, 'Vocabulary item not found or unavailable.');

    const { error } = await context.supabase.from('user_vocabulary_progress')
      .insert({ user_id: context.user.id, vocabulary_id: input.vocabularyId });
    // A duplicate means the word was already learned; treat this as idempotent success.
    if (error && error.code !== '23505') {
      throw new HttpError(500, 'Could not mark this word as learned.', error.message);
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
    const input = await readJson(request, vocabularyProgressSchema);

    const { error } = await context.supabase.from('user_vocabulary_progress')
      .delete()
      .eq('user_id', context.user.id)
      .eq('vocabulary_id', input.vocabularyId);
    if (error) throw new HttpError(500, 'Could not move this word back to new vocabulary.', error.message);

    return NextResponse.json({ learned: false });
  } catch (error) {
    return jsonError(error);
  }
}
