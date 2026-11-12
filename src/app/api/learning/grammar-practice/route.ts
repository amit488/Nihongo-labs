import { connection, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { requireUser } from '@/lib/nihongo/server/supabase';

const attemptSchema = z.object({
  grammarId: z.string().uuid(),
  questionId: z.string().min(1).max(120),
  answer: z.string().min(1).max(2000),
}).strict();

function normalizeAnswer(value: string) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

export async function POST(request: NextRequest) {
  await connection();
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, attemptSchema);
    const { data, error } = await context.supabase
      .from('grammar_points')
      .select('id,practice_questions')
      .eq('id', input.grammarId)
      .eq('publication_status', 'published')
      .maybeSingle();
    if (error || !data) throw new HttpError(404, 'Grammar set not found.');
    const questions = Array.isArray(data.practice_questions)
      ? data.practice_questions as Array<{ id?: string; answer?: string; explanation?: string }>
      : [];
    const question = questions.find((row) => row.id === input.questionId);
    if (!question || typeof question.answer !== 'string') {
      throw new HttpError(404, 'Grammar question not found.');
    }
    const correct = normalizeAnswer(input.answer) === normalizeAnswer(question.answer);
    const { error: saveError } = await context.supabase
      .from('user_grammar_practice_attempts')
      .insert({
        user_id: context.user.id,
        grammar_id: input.grammarId,
        question_id: input.questionId,
        selected_answer: input.answer,
        is_correct: correct,
      });
    if (saveError) throw new HttpError(500, 'Could not save your grammar attempt.', saveError.message);
    return NextResponse.json({
      correct,
      answer: question.answer,
      explanation: question.explanation ?? '',
    });
  } catch (error) {
    return jsonError(error);
  }
}
