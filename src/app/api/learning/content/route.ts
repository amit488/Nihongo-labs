import { connection, NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type FlashcardContentRow = {
  id: string; deck_id: string; front_text: string; back_text: string;
  front_reading: string | null; back_reading: string | null;
  front_romaji: string | null; back_romaji: string | null;
  hint: string | null; example_sentence: string | null; example_translation: string | null;
  sort_order: number; source_type: string | null;
};
type FlashcardDeckRow = { id: string; slug: string; title: string; flashcards: FlashcardContentRow[] | null };
type ReadingBlockRow = { id: string; block_type: string; content: Record<string, unknown>; sort_order: number };
type ReadingLessonRow = {
  id: string; title: string; lesson_type: string; publication_status: string;
  lesson_content_blocks: ReadingBlockRow[] | null;
};
type ReadingUnitRow = { id: string; lessons: ReadingLessonRow[] | null };
type ReadingCourseRow = { id: string; course_units: ReadingUnitRow[] | null };

const kana = {
  hiragana: [
    ['あ','い','う','え','お'],['か','き','く','け','こ'],['さ','し','す','せ','そ'],['た','ち','つ','て','と'],['な','に','ぬ','ね','の'],
    ['は','ひ','ふ','へ','ほ'],['ま','み','む','め','も'],['や','','ゆ','','よ'],['ら','り','る','れ','ろ'],['わ','','','','を'],['ん','','','',''],
  ],
  katakana: [
    ['ア','イ','ウ','エ','オ'],['カ','キ','ク','ケ','コ'],['サ','シ','ス','セ','ソ'],['タ','チ','ツ','テ','ト'],['ナ','ニ','ヌ','ネ','ノ'],
    ['ハ','ヒ','フ','ヘ','ホ'],['マ','ミ','ム','メ','モ'],['ヤ','','ユ','','ヨ'],['ラ','リ','ル','レ','ロ'],['ワ','','','','ヲ'],['ン','','','',''],
  ],
  romaji: [
    ['a','i','u','e','o'],['ka','ki','ku','ke','ko'],['sa','shi','su','se','so'],['ta','chi','tsu','te','to'],['na','ni','nu','ne','no'],
    ['ha','hi','fu','he','ho'],['ma','mi','mu','me','mo'],['ya','','yu','','yo'],['ra','ri','ru','re','ro'],['wa','','','','wo'],['n','','','',''],
  ],
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const kind = request.nextUrl.searchParams.get('kind') || 'grammar';
    const level = request.nextUrl.searchParams.get('level') || 'N5';
    const rawSearch = request.nextUrl.searchParams.get('q')?.trim() ?? '';
    // Avoid PostgREST filter grammar injection through the .or(...) expression.
    const search = rawSearch.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').slice(0, 80).trim();
    const requestedDefault = kind === 'vocabulary' ? 80 : 100;
    const rawLimit = Number(request.nextUrl.searchParams.get('limit') || requestedDefault);
    const maxLimit = kind === 'vocabulary' ? 100 : 250;
    const limit = Number.isFinite(rawLimit) ? Math.min(maxLimit, Math.max(1, Math.floor(rawLimit))) : requestedDefault;
    const rawOffset = Number(request.nextUrl.searchParams.get('offset') || 0);
    const offset = Number.isFinite(rawOffset) ? Math.min(10000, Math.max(0, Math.floor(rawOffset))) : 0;
    if (!['N5', 'N4', 'N3', 'N2', 'N1'].includes(level)) throw new HttpError(400, 'Unsupported JLPT level.');
    const supabase = await createServerSupabase();

    if (kind === 'kana') return NextResponse.json({ ...kana, rows: kana.romaji, combinations: ['きゃ','きゅ','きょ','しゃ','しゅ','しょ','ちゃ','ちゅ','ちょ','にゃ','にゅ','にょ','ひゃ','ひゅ','ひょ','みゃ','みゅ','みょ','りゃ','りゅ','りょ','ぎゃ','ぎゅ','ぎょ','じゃ','じゅ','じょ','びゃ','びゅ','びょ','ぴゃ','ぴゅ','ぴょ'] });

    if (kind === 'grammar') {
      let query = supabase.from('grammar_points').select('id,title,pattern,explanation,formation,examples,common_mistakes,related_grammar_ids').eq('jlpt_level', level).eq('publication_status', 'published').order('title').limit(limit);
      if (search) query = query.or(`title.ilike.%${search}%,pattern.ilike.%${search}%,explanation.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw new HttpError(500, 'Could not load grammar content.', error.message);
      return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
    }
    if (kind === 'vocabulary') {
      let query = supabase.from('vocabulary_entries')
        .select('id,word,kana,romaji,meaning,part_of_speech,example_sentence,example_reading,example_translation,tags')
        .eq('jlpt_level', level).eq('publication_status', 'published')
        .order('word', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + limit);
      if (search) query = query.or(`word.ilike.%${search}%,kana.ilike.%${search}%,meaning.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw new HttpError(500, 'Could not load vocabulary.', error.message);
      const rows = data ?? [];
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;
      return NextResponse.json(
        { items, hasMore, nextOffset: offset + items.length },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
      );
    }
    if (kind === 'kanji') {
      let query = supabase.from('kanji_entries').select('id,character,meaning,on_yomi,kun_yomi,stroke_count,radical,mnemonic,example_words').eq('jlpt_level', level).eq('publication_status', 'published').order('character').limit(limit);
      if (search) query = query.or(`character.ilike.%${search}%,meaning.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) throw new HttpError(500, 'Could not load kanji.', error.message);
      return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
    }
    if (kind === 'courses') {
      const { data, error } = await supabase.from('courses').select('id,slug,title,subtitle,description,jlpt_level,access_level,learning_outcomes,estimated_duration_minutes,course_units(id,slug,title,description,sort_order,lessons(id,slug,title,summary,lesson_type,access_level,estimated_duration_minutes,sort_order))').eq('jlpt_level', level).eq('publication_status', 'published').order('sort_order').limit(limit);
      if (error) throw new HttpError(500, 'Could not load courses.', error.message);
      return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }
    if (kind === 'flashcards') {
      const { data: decks, error: deckError } = await supabase.from('flashcard_decks')
        .select('id,slug,title,description,jlpt_level,access_level,deck_type,flashcards(id,deck_id,front_text,back_text,front_reading,back_reading,front_romaji,back_romaji,hint,example_sentence,example_translation,sort_order,source_type)')
        .eq('deck_type', 'official').eq('jlpt_level', level).eq('visibility', 'public').eq('publication_status', 'published').limit(limit);
      if (deckError) throw new HttpError(500, 'Could not load flashcard decks.', deckError.message);
      const deckRows = (decks ?? []) as unknown as FlashcardDeckRow[];
      const items = deckRows.flatMap((deck) => [...(deck.flashcards ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((card) => ({ ...card, deckId: deck.id, deckTitle: deck.title, deckSlug: deck.slug })));
      return NextResponse.json({ items }, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }
    if (kind === 'reading') {
      const { data, error } = await supabase.from('courses').select('id,course_units(id,lessons(id,slug,title,summary,lesson_type,publication_status,access_level,lesson_content_blocks(id,block_type,content,sort_order)))').eq('jlpt_level', level).eq('publication_status', 'published').limit(10);
      if (error) throw new HttpError(500, 'Could not load reading lessons.', error.message);
      const courseRows = (data ?? []) as unknown as ReadingCourseRow[];
      const lessons = courseRows.flatMap((course) =>
        (course.course_units ?? []).flatMap((unit) =>
          (unit.lessons ?? []).filter((lesson) =>
            lesson.publication_status === 'published' &&
            (lesson.lesson_type === 'lesson' || lesson.lesson_type === 'practice'),
          ),
        ),
      );
      const passages = lessons.flatMap((lesson) => (lesson.lesson_content_blocks ?? [])
        .filter((block) => block.block_type === 'rich_text' && block.content.kind === 'reading_passage')
        .map((block) => ({ lessonId: lesson.id, lessonTitle: lesson.title, ...block.content })));
      return NextResponse.json({ items: passages.slice(0, limit) }, { headers: { 'Cache-Control': 'private, max-age=30' } });
    }
    throw new HttpError(400, 'Unsupported content kind. Use grammar, vocabulary, kanji, kana, courses, flashcards or reading.');
  } catch (error) { return jsonError(error); }
}
