import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type EventRow = { skill_tag: string; is_correct: boolean; created_at: string };

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

    const { data, error } = await context.supabase.from('grammar_attempt_events')
      .select('skill_tag,is_correct,created_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(3000);
    if (error) throw new HttpError(500, 'Could not load grammar mistake insights. Apply the learning intelligence migration first.', error.message);

    const groups = new Map<string, EventRow[]>();
    for (const row of (data ?? []) as EventRow[]) {
      const bucket = groups.get(row.skill_tag) ?? [];
      bucket.push(row);
      groups.set(row.skill_tag, bucket);
    }

    const topics = [...groups.entries()].map(([tag, rows]) => {
      const attempts = rows.length;
      const misses = rows.filter((row) => !row.is_correct);
      const correct = attempts - misses.length;
      const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
      const latestMiss = misses[0]?.created_at ?? null;
      const weak = misses.length >= 2 || (attempts >= 2 && accuracy < 70) || (!rows[0]?.is_correct && attempts >= 1);
      return {
        tag,
        label: LABELS[tag] ?? tag.replace(/^grammar:/, '').replace(/[-_:]/g, ' '),
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

    const totalAttempts = (data ?? []).length;
    const totalCorrect = (data ?? []).filter((row: EventRow) => row.is_correct).length;
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
