import { connection, NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type SearchResult = {
  id: string;
  kind: 'Vocabulary' | 'Grammar' | 'Kanji' | 'Lesson' | 'Course';
  level: string;
  title: string;
  detail: string;
  href: string;
};

export async function GET(request: NextRequest) {
  await connection();
  try {
    const raw = request.nextUrl.searchParams.get('q') ?? '';
    // The query is embedded in PostgREST .or() expressions, so keep it to
    // letters, numbers, spaces and hyphens before building those filters.
    const query = raw.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').slice(0, 60).trim();
    if (query.length < 2) return NextResponse.json({ items: [] });

    const pattern = `%${query}%`;
    const supabase = await createServerSupabase();
    const [vocabulary, grammar, kanji, lessons, courses] = await Promise.all([
      supabase.from('vocabulary_entries')
        .select('id,word,kana,meaning,jlpt_level')
        .eq('publication_status', 'published')
        .or(`word.ilike.${pattern},kana.ilike.${pattern},meaning.ilike.${pattern},romaji.ilike.${pattern}`)
        .limit(5),
      supabase.from('grammar_points')
        .select('id,title,pattern,explanation,jlpt_level')
        .eq('publication_status', 'published')
        .or(`title.ilike.${pattern},pattern.ilike.${pattern},explanation.ilike.${pattern}`)
        .limit(5),
      supabase.from('kanji_entries')
        .select('id,character,meaning,jlpt_level')
        .eq('publication_status', 'published')
        .or(`character.ilike.${pattern},meaning.ilike.${pattern}`)
        .limit(5),
      supabase.from('lessons')
        .select('id,title,summary,lesson_type,course_units!inner(slug,courses!inner(jlpt_level))')
        .eq('publication_status', 'published')
        .or(`title.ilike.${pattern},summary.ilike.${pattern}`)
        .limit(5),
      supabase.from('courses')
        .select('id,title,subtitle,description,jlpt_level')
        .eq('publication_status', 'published')
        .or(`title.ilike.${pattern},subtitle.ilike.${pattern},description.ilike.${pattern}`)
        .limit(3),
    ]);

    const firstError = vocabulary.error || grammar.error || kanji.error || lessons.error || courses.error;
    if (firstError) throw new HttpError(500, 'Search could not be completed.', firstError.message);

    const results: SearchResult[] = [
      ...(vocabulary.data ?? []).map((row) => ({
        id: row.id,
        kind: 'Vocabulary' as const,
        level: row.jlpt_level,
        title: row.word,
        detail: [row.kana, row.meaning].filter(Boolean).join(' · '),
        href: `/learn/vocabulary?search=${encodeURIComponent(query)}`,
      })),
      ...(grammar.data ?? []).map((row) => ({
        id: row.id,
        kind: 'Grammar' as const,
        level: row.jlpt_level,
        title: row.title,
        detail: [row.pattern, row.explanation].filter(Boolean).join(' · ').slice(0, 150),
        href: `/learn/grammar?search=${encodeURIComponent(query)}`,
      })),
      ...(kanji.data ?? []).map((row) => ({
        id: row.id,
        kind: 'Kanji' as const,
        level: row.jlpt_level,
        title: row.character,
        detail: row.meaning,
        href: `/learn/kanji?search=${encodeURIComponent(query)}`,
      })),
      ...(lessons.data ?? []).map((row) => {
        const unit = row.course_units as unknown as { slug?: string; courses?: { jlpt_level?: string } } | null;
        const sectionByUnit: Record<string, string> = {
          grammar: 'grammar', vocabulary: 'vocabulary', kanji: 'kanji',
          kana: 'kana', reading: 'reading', practice: 'practice', exams: 'exams',
        };
        const section = unit?.slug ? sectionByUnit[unit.slug] || 'reading' : 'reading';
        return {
          id: row.id,
          kind: 'Lesson' as const,
          level: unit?.courses?.jlpt_level || '',
          title: row.title,
          detail: row.summary || row.lesson_type.replaceAll('_', ' '),
          href: `/learn/${section}?search=${encodeURIComponent(query)}`,
        };
      }),
      ...(courses.data ?? []).map((row) => ({
        id: row.id,
        kind: 'Course' as const,
        level: row.jlpt_level,
        title: row.title,
        detail: row.subtitle || row.description || 'Learning course',
        href: '/learn',
      })),
    ];

    return NextResponse.json(
      { items: results.slice(0, 18) },
      { headers: { 'Cache-Control': 'private, max-age=15, stale-while-revalidate=30' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
