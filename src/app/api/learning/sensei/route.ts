import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, createAdminSupabase } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson, requireEnv } from '@/lib/nihongo/server/http';
import { getUserTimeZone } from '@/lib/nihongo/server/activity';
import { localDateKey } from '@/lib/nihongo/server/date';

const requestSchema = z.object({
  level: z.enum(['N5', 'N4', 'N3', 'N2', 'N1']).optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(1500),
  }).strict()).min(1).max(10),
}).strict().superRefine((value, context) => {
  if (value.messages[value.messages.length - 1]?.role !== 'user') {
    context.addIssue({ code: 'custom', message: 'The latest message must be a learner question.', path: ['messages'] });
  }
});

const replySchema = z.object({
  answer: z.string(),
  level_note: z.string(),
  grammar_breakdown: z.object({
    pattern: z.string(), formation: z.string(), usage: z.string(),
  }).strict(),
  examples: z.array(z.object({
    japanese: z.string(), romaji: z.string(), translation: z.string(), focus: z.string(),
  }).strict()).min(1).max(4),
  common_confusion: z.string(),
  vocabulary: z.array(z.object({
    word: z.string(), reading: z.string(), meaning: z.string(),
  }).strict()).max(8),
  mini_quiz: z.object({
    question: z.string(), options: z.array(z.string()).min(2).max(5),
    correct_answer: z.string(), explanation: z.string(),
  }).strict(),
  follow_up: z.string(),
}).strict();

const responseFormat = {
  type: 'json_schema',
  name: 'nihongo_sensei_reply',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['answer','level_note','grammar_breakdown','examples','common_confusion','vocabulary','mini_quiz','follow_up'],
    properties: {
      answer: { type: 'string' },
      level_note: { type: 'string' },
      grammar_breakdown: {
        type: 'object', additionalProperties: false, required: ['pattern','formation','usage'],
        properties: { pattern: { type: 'string' }, formation: { type: 'string' }, usage: { type: 'string' } },
      },
      examples: {
        type: 'array', minItems: 1, maxItems: 4, items: {
          type: 'object', additionalProperties: false, required: ['japanese','romaji','translation','focus'],
          properties: { japanese: { type: 'string' }, romaji: { type: 'string' }, translation: { type: 'string' }, focus: { type: 'string' } },
        },
      },
      common_confusion: { type: 'string' },
      vocabulary: {
        type: 'array', maxItems: 8, items: {
          type: 'object', additionalProperties: false, required: ['word','reading','meaning'],
          properties: { word: { type: 'string' }, reading: { type: 'string' }, meaning: { type: 'string' } },
        },
      },
      mini_quiz: {
        type: 'object', additionalProperties: false, required: ['question','options','correct_answer','explanation'],
        properties: {
          question: { type: 'string' },
          options: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'string' } },
          correct_answer: { type: 'string' },
          explanation: { type: 'string' },
        },
      },
      follow_up: { type: 'string' },
    },
  },
} as const;

function outputText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const result = payload as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof result.output_text === 'string' && result.output_text.trim()) return result.output_text;
  for (const item of result.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  return '';
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, requestSchema, 32 * 1024);
    const apiKey = requireEnv('OPENAI_API_KEY');
    const admin = createAdminSupabase();

    const [{ data: preferences }, { data: premium, error: premiumError }, { data: recentMistakes, error: mistakesError }, { data: quickMistakes, error: quickError }, { data: vocabularyStates, error: vocabularyError }] = await Promise.all([
      context.supabase.from('user_preferences').select('preferred_jlpt_level').eq('user_id', context.user.id).maybeSingle(),
      context.supabase.from('user_entitlements').select('id').eq('user_id', context.user.id)
        .eq('feature_key', 'premium_content').eq('status', 'active').limit(1).maybeSingle(),
      context.supabase.from('grammar_attempt_events').select('skill_tag,is_correct')
        .eq('user_id', context.user.id).order('created_at', { ascending: false }).limit(80),
      context.supabase.from('quick_revision_attempts').select('content_id,is_correct')
        .eq('user_id', context.user.id).eq('content_type', 'grammar')
        .order('created_at', { ascending: false }).limit(80),
      context.supabase.from('vocabulary_review_state')
        .select('due_at,repetitions,last_rating,vocabulary_entries!inner(word,kana,meaning,part_of_speech,example_sentence)')
        .eq('user_id', context.user.id).order('due_at', { ascending: true }).limit(40),
    ]);
    if (premiumError || mistakesError || quickError || vocabularyError) throw new HttpError(503, 'Learning context is not ready. Apply the learning intelligence migration and check your Supabase policies.', premiumError?.message || mistakesError?.message || quickError?.message || vocabularyError?.message);
    const level = input.level ?? preferences?.preferred_jlpt_level ?? 'N5';
    const mistakeMap = new Map<string, { attempts: number; misses: number }>();
    const mistakeLabels = new Map<string, string>();
    for (const row of recentMistakes ?? []) {
      const value = mistakeMap.get(row.skill_tag) ?? { attempts: 0, misses: 0 };
      value.attempts += 1;
      if (!row.is_correct) value.misses += 1;
      mistakeMap.set(row.skill_tag, value);
    }
    const quickGrammarIds = [...new Set((quickMistakes ?? []).map((row) => row.content_id))];
    if (quickGrammarIds.length) {
      const { data: grammarPoints, error: grammarError } = await context.supabase.from('grammar_points')
        .select('id,title,pattern,learning_tags').in('id', quickGrammarIds);
      if (grammarError) throw new HttpError(503, 'Could not load your grammar learning context.', grammarError.message);
      const labels = new Map((grammarPoints ?? []).map((point) => [point.id, {
        title: point.title || point.pattern || 'Grammar point',
        tags: (point.learning_tags ?? []).filter((tag: unknown): tag is string => typeof tag === 'string'),
      }]));
      for (const row of quickMistakes ?? []) {
        const point = labels.get(row.content_id);
        const tags = point?.tags.length ? point.tags : [`grammar-point:${row.content_id}`];
        for (const tag of tags) {
          if (point) mistakeLabels.set(tag, point.title);
          const value = mistakeMap.get(tag) ?? { attempts: 0, misses: 0 };
          value.attempts += 1;
          if (!row.is_correct) value.misses += 1;
          mistakeMap.set(tag, value);
        }
      }
    }
    const weakTopics = [...mistakeMap.entries()].filter(([, value]) => value.misses > 0)
      .sort((a,b)=>b[1].misses-a[1].misses).slice(0,6)
      .map(([tag,value])=>({tag,label:mistakeLabels.get(tag) ?? tag,attempts:value.attempts,misses:value.misses}));

    const now = Date.now();
    const vocabularyToReview = (vocabularyStates ?? []).flatMap((row) => {
      const related = row.vocabulary_entries;
      const word = Array.isArray(related) ? related[0] : related;
      if (!word) return [];
      const dueAt = Date.parse(row.due_at);
      const due = Number.isFinite(dueAt) && dueAt <= now;
      const lastRating = typeof row.last_rating === 'number' ? row.last_rating : null;
      const atRisk = (lastRating !== null && lastRating <= 2) || (due && Number(row.repetitions) < 2);
      if (!due && !atRisk) return [];
      return [{
        word: word.word, kana: word.kana, meaning: word.meaning,
        partOfSpeech: word.part_of_speech, example: word.example_sentence,
        due, atRisk, repetitions: Number(row.repetitions), lastRating,
      }];
    }).sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || Number(b.due) - Number(a.due)).slice(0, 8);

    const timezone = await getUserTimeZone(admin, context.user.id);
    const usageDate = localDateKey(new Date(), timezone);
    const dailyLimit = premium?.id ? 50 : 8;
    const { data: quota, error: quotaError } = await admin.rpc('consume_ai_sensei_request', {
      _user_id: context.user.id, _usage_date: usageDate, _daily_limit: dailyLimit,
    });
    if (quotaError) throw new HttpError(503, 'AI Sensei usage limits are not configured. Apply the learning intelligence migration.', quotaError.message);
    if (!quota?.allowed) throw new HttpError(429, `You have used today’s ${dailyLimit} Sensei messages. Your daily allowance resets tomorrow.`);

    const system = `You are NihongoLabs Japanese Sensei, a careful, encouraging Japanese teacher.
Teach at JLPT level ${level}. Use clear, concise English unless the learner asks for Japanese.
Correct errors gently and explain the underlying reason, not just the answer.
For grammar, explain the exact pattern, formation, function, nuance, and common contrasts.
For vocabulary, explain readings, part of speech, natural usage and collocations where relevant.
For sentences, parse them in order, distinguish particles and conjugations, and give natural translations.
Give 2-3 natural Japanese examples with accurate kana/kanji, accurate romaji and English translations.
Keep examples suitable for the requested JLPT level unless a harder form is explicitly being explained.
Do not invent official JLPT rules or claim that a word is definitively in a JLPT list unless certain.
When a question is ambiguous, state the likely interpretation and ask one focused clarification in follow_up.
The mini_quiz must test the exact concept in the answer; correct_answer must exactly match one option.
If uncertain about a linguistic nuance, say so plainly instead of fabricating.
Personalise practice using this learner context when relevant: ${JSON.stringify({jlptLevel: level, weakGrammarTopics: weakTopics, vocabularyToReview})}.
When a learner asks about a saved word, use its saved meaning, part of speech and example as the starting point; distinguish that curriculum context from any general explanation. Connect explanations to weak grammar patterns only when relevant. Do not assume a word is unknown just because it is absent from this short context.
For Japanese sentence analysis, parse particles and conjugations in order, explain kanji readings in context, and use consistent Hepburn romaji.
Return only the required structured fields.`;

    const model = process.env.OPENAI_SENSEI_MODEL || 'gpt-6-luna';
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1400,
        instructions: system,
        input: input.messages.slice(-10).map((message) => ({ role: message.role, content: message.content })),
        text: { format: responseFormat },
      }),
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '');
      console.error('[Nihongo Labs Sensei] Provider error:', upstream.status, errorText.slice(0, 500));
      if (upstream.status === 401 || upstream.status === 403) throw new HttpError(503, 'The AI provider rejected the server API key or model access. Check your OpenAI API project settings.');
      if (upstream.status === 429) throw new HttpError(503, 'The AI provider is temporarily rate-limited or out of API quota. Check your OpenAI API billing and limits.');
      throw new HttpError(502, 'Japanese Sensei is temporarily unavailable. Please try again.');
    }
    const payload = await upstream.json() as unknown;
    const text = outputText(payload);
    if (!text) throw new HttpError(502, 'Sensei returned an empty answer. Please try again.');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new HttpError(502, 'Sensei returned an unreadable answer. Please try again.'); }
    const replyResult = replySchema.safeParse(raw);
    if (!replyResult.success) throw new HttpError(502, 'Sensei returned an incomplete teaching response. Please try again.');
    const reply = replyResult.data;
    if (!reply.mini_quiz.options.some((option) => option.trim() === reply.mini_quiz.correct_answer.trim())) {
      throw new HttpError(502, 'Sensei returned a quiz with an inconsistent answer key. Please try again.');
    }

    const usage = (payload as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    return NextResponse.json({
      reply,
      remaining: Number(quota.remaining ?? Math.max(0, dailyLimit - Number(quota.requestCount ?? 0))),
      usage: { inputTokens: Number(usage?.input_tokens ?? 0), outputTokens: Number(usage?.output_tokens ?? 0) },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
