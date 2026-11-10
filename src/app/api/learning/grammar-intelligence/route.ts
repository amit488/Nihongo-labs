import { connection, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { HttpError, jsonError } from '@/lib/nihongo/server/http';

type GrammarTopicRow = {
  tag: string;
  attempts: number;
  misses: number;
  accuracy: number;
  latestMiss: string | null;
  weak: boolean;
  labelOverride: string | null;
};
type GrammarIntelligencePayload = {
  totalAttempts: number;
  accuracy: number;
  weakTopicCount: number;
  topics: GrammarTopicRow[];
  hasTaggedHistory: boolean;
};

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
  'grammar:conditional': 'Conditionals — と / ば / たら / なら',
  'grammar:purpose': 'Purpose — ために / ように',
  'grammar:reason': 'Giving reasons — から / ので',
  'grammar:comparison': 'Comparisons — より / ほど',
  'grammar:passive': 'Passive voice',
  'grammar:causative': 'Causative form',
  'grammar:potential': 'Potential form and ability',
  'grammar:experience': 'Past experience — たことがある',
  'grammar:obligation': 'Obligation and necessity',
  'grammar:request': 'Requests and polite requests',
  'grammar:permission': 'Permission and prohibition',
  'grammar:appearance': 'Appearance — そう / よう',
  'grammar:hearsay': 'Hearsay — そう / らしい',
  'grammar:preparation': 'Preparation — ておく',
  'grammar:habit': 'Habits and routines',
  'grammar:sequence': 'Sequence of actions',
  'grammar:time-order': 'Time order — 前に / 後で',
  'grammar:nominalization': 'Nominalisation — こと / の',
  'grammar:giving-receiving': 'Giving and receiving',
  'grammar:recommendation': 'Advice — ほうがいい',
  'grammar:concession': 'Concession — ても / でも',
  'grammar:only': 'Only — だけ / しか',
  'grammar:decision': 'Decisions — ことにする / なる',
  'grammar:state-result': 'Resulting state — てある',
  'grammar:too-much': 'Excess — すぎる',
  'adjective:negative': 'Adjective negative forms',
  'adjective:past': 'Adjective past forms',
};

export async function GET() {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);

    const { data, error } = await context.supabase.rpc('get_grammar_intelligence');
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      throw new HttpError(500, 'Could not load grammar mistake insights. Apply the learning intelligence and Quick Revision migrations first.', error?.message);
    }

    const payload = data as GrammarIntelligencePayload;
    const topics = (payload.topics ?? []).map((topic) => ({
      tag: topic.tag,
      label: LABELS[topic.tag] ?? topic.labelOverride
        ?? topic.tag.replace(/^grammar:/, '').replace(/^grammar-point:/, 'Grammar point ').replace(/[-_:]/g, ' '),
      attempts: topic.attempts,
      misses: topic.misses,
      accuracy: topic.accuracy,
      latestMiss: topic.latestMiss,
      weak: topic.weak,
      recommendation: topic.weak
        ? 'Revisit the rule, compare two similar examples, then complete a short targeted drill.'
        : topic.accuracy >= 85
          ? 'Good recall. Keep this concept in spaced revision.'
          : 'Continue practising to build a reliable pattern.',
    }));

    return NextResponse.json({
      totalAttempts: payload.totalAttempts,
      accuracy: payload.accuracy,
      weakTopicCount: payload.weakTopicCount,
      topics,
      hasTaggedHistory: payload.hasTaggedHistory,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
