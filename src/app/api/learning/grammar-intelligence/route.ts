import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type EventRow = { skill_tag: string; is_correct: boolean; created_at: string };
type QuickRow = { content_id: string; is_correct: boolean; created_at: string };
type GrammarPoint = { id: string; title: string | null; pattern: string | null; learning_tags: string[] | null };

const LABELS: Record<string, string> = {
  'particle:wa-vs-ga': 'は vs が — topic and subject',
  'particle:ni-vs-de': 'に vs で — destination, time and action location',
  'particle:wo': 'を — direct object marker',
  'particle:no': 'の — possession and noun connection',
  'particle:he-vs-ni': 'へ vs に — direction and destination',
  'verb:te-form': 'て-form — requests and connected actions',
  'verb:past': 'Past tense — ました / ませんでした',
  'verb:negative': 'Negative verb forms',
  'adjective:conjugation': 'い-adjective and な-adjective conjugation',
  'grammar:general': 'General grammar foundations',
};

export async function GET() {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const [{ data, error }, { data: quickRows, error: quickError }] = await Promise.all([
      context.supabase.from('grammar_attempt_events')
        .select('skill_tag,is_correct,created_at')
        .eq('user_id', context.user.id)
        .order('created_at', { ascending: false })
        .limit(3000),
      context.supabase.from('quick_revision_attempts')
        .select('content_id,is_correct,created_at')
        .eq('user_id', context.user.id)
        .eq('content_type', 'grammar')
        .order('created_at', { ascending: false })
        .limit(3000),
    ]);
    if (error || quickError) throw new HttpError(500, 'Could not load grammar mistake insights. Apply the learning intelligence migration and site-wide Quick Revision migration first.', error?.message || quickError?.message);

    const grammarIds = [...new Set((quickRows ?? []).map((row) => row.content_id))];
    let points: GrammarPoint[] = [];
    if (grammarIds.length) {
      const { data: pointRows, error: pointError } = await context.supabase.from('grammar_points')
        .select('id,title,pattern,learning_tags').in('id', grammarIds);
      if (pointError) throw new HttpError(500, 'Could not resolve grammar topics for your Quick Revision history.', pointError.message);
      points = (pointRows ?? []) as GrammarPoint[];
    }
    const pointById = new Map(points.map((point) => [point.id, point]));
    const labelByTag = new Map<string, string>();
    const allRows: EventRow[] = [...((data ?? []) as EventRow[])];
    for (const row of (quickRows ?? []) as QuickRow[]) {
      const point = pointById.get(row.content_id);
      const tags = (point?.learning_tags ?? []).filter((tag) => typeof tag === 'string' && /^[a-z0-9:_-]{2,80}$/i.test(tag));
      const effectiveTags = tags.length ? [...new Set(tags)] : [`grammar-point:${row.content_id}`];
      for (const tag of effectiveTags) {
        if (point) labelByTag.set(tag, point.title || point.pattern || 'Grammar point');
        allRows.push({ skill_tag: tag, is_correct: row.is_correct, created_at: row.created_at });
      }
    }

    const groups = new Map<string, EventRow[]>();
    for (const row of allRows) {
      const bucket = groups.get(row.skill_tag) ?? [];
      bucket.push(row);
      groups.set(row.skill_tag, bucket);
    }

    const topics = [...groups.entries()].map(([tag, rows]) => {
      const ordered = [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const attempts = ordered.length;
      const misses = ordered.filter((row) => !row.is_correct);
      const correct = attempts - misses.length;
      const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
      const latestMiss = misses[0]?.created_at ?? null;
      const weak = misses.length >= 2 || (attempts >= 2 && accuracy < 70) || (!ordered[0]?.is_correct && attempts >= 1);
      return {
        tag,
        label: LABELS[tag] ?? labelByTag.get(tag) ?? tag.replace(/^grammar:/, '').replace(/^grammar-point:/, 'Grammar point ').replace(/[-_:]/g, ' '),
        attempts,
        misses: misses.length,
        accuracy,
        latestMiss,
        weak,
        recommendation: weak
          ? 'Revisit the rule, compare two similar examples, then complete a short targeted drill.'
          : accuracy >= 85
            ? 'Good recall. Keep this concept in spaced revision.'
            : 'Continue practising to build a reliable pattern.',
      };
    }).sort((a, b) => Number(b.weak) - Number(a.weak) || b.misses - a.misses || a.accuracy - b.accuracy);

    const taggedEvents = (data ?? []) as EventRow[];
    const quickEvents = (quickRows ?? []) as QuickRow[];
    const totalAttempts = taggedEvents.length + quickEvents.length;
    const totalCorrect = taggedEvents.filter((row) => row.is_correct).length
      + quickEvents.filter((row) => row.is_correct).length;
    return NextResponse.json({
      totalAttempts,
      accuracy: totalAttempts ? Math.round(totalCorrect / totalAttempts * 100) : 0,
      weakTopicCount: topics.filter((topic) => topic.weak).length,
      topics: topics.slice(0, 10),
      hasTaggedHistory: totalAttempts > 0,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
