import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../http';
import { answerForLearner, explanationText, gradeAnswer, type JsonValue } from '../grading';
import { getUserTimeZone } from '../activity';
import { localDateKey } from '../date';

type QuizAnswerKey = {
  question_id: string;
  answer_key: JsonValue;
  explanation: JsonValue;
};
type QuizOptionRow = { option_key: string; option_content: JsonValue; sort_order: number };
type QuizQuestionRow = {
  id: string; question_type: string; prompt: JsonValue; points: number;
  sort_order: number; media_asset_id: string | null; quiz_options: QuizOptionRow[] | null;
};
type GradedResponse = {
  attempt_id: string; user_id: string; question_id: string; response: unknown;
  is_correct: boolean; points_awarded: number; answered_at: string;
};

export async function startQuizAttempt(userClient: SupabaseClient, admin: SupabaseClient, userId: string, quizId: string) {
  const { data: quiz, error: quizError } = await userClient.from('quizzes')
    .select('id,slug,title,description,time_limit_seconds,pass_percentage,max_attempts,access_level,publication_status,show_results_after_submit,shuffle_questions')
    .eq('id', quizId).eq('publication_status', 'published').maybeSingle();
  if (quizError || !quiz) throw new HttpError(404, 'Quiz not found or unavailable.');

  const requiredFeature = /mock/i.test(String(quiz.slug)) ? 'mock_exams' : quiz.access_level === 'premium' ? 'premium_content' : null;
  if (requiredFeature) {
    const now = new Date().toISOString();
    const { data: entitlement, error: entitlementError } = await userClient.from('user_entitlements').select('id')
      .eq('feature_key', requiredFeature).eq('status', 'active').lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`).limit(1).maybeSingle();
    if (entitlementError) throw new HttpError(500, 'Could not verify your learning entitlement.', entitlementError.message);
    if (!entitlement) throw new HttpError(403, requiredFeature === 'mock_exams' ? 'Mock examinations require the Plus plan.' : 'This quiz requires Premium access.');
  }

  const questionQuery = userClient.from('quiz_questions')
    .select('id,question_type,prompt,points,sort_order,media_asset_id,quiz_options(id,option_key,option_content,sort_order)')
    .eq('quiz_id', quizId).eq('is_active', true).order('sort_order', { ascending: true });
  const { data: questions, error: questionsError } = await questionQuery;
  if (questionsError) throw new HttpError(500, 'Could not load quiz questions.', questionsError.message);
  if (!questions?.length) throw new HttpError(409, 'This quiz has no published questions yet.');
  const orderedQuestions = [...(questions as unknown as QuizQuestionRow[])];
  if (quiz.shuffle_questions) {
    for (let index = orderedQuestions.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [orderedQuestions[index], orderedQuestions[swap]] = [orderedQuestions[swap], orderedQuestions[index]];
    }
  }
  const safeQuestions = orderedQuestions.map((question) => ({
    id: question.id,
    type: question.question_type,
    prompt: question.prompt,
    points: Number(question.points),
    mediaAssetId: question.media_asset_id,
    options: [...(question.quiz_options ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({ key: option.option_key, content: option.option_content })),
  }));

  const { data: reserved, error: attemptError } = await admin.rpc('reserve_quiz_attempt', {
    _user_id: userId,
    _quiz_id: quizId,
  });
  if (attemptError || !reserved?.[0]) {
    if (attemptError?.code === '42501') throw new HttpError(403, 'You have reached the attempt limit for this quiz.');
    if (attemptError?.code === 'P0002') throw new HttpError(404, 'Quiz not found or unavailable.');
    throw new HttpError(500, 'Could not reserve quiz attempt. Run sql/011_backend_rpc.sql first.', attemptError?.message);
  }

  return { attemptId: reserved[0].attempt_id, startedAt: reserved[0].started_at, quiz: { ...quiz, questions: safeQuestions } };
}

export async function submitQuizAttempt(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: { attemptId: string; responses: Array<{ questionId: string; response: unknown }> },
) {
  const { data: attempt, error: attemptError } = await userClient.from('quiz_attempts')
    .select('id,quiz_id,status,started_at').eq('id', input.attemptId).eq('user_id', userId).maybeSingle();
  if (attemptError || !attempt) throw new HttpError(404, 'Quiz attempt not found.');
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This quiz attempt has already been submitted.');

  const { data: quiz, error: quizError } = await userClient.from('quizzes')
    .select('id,title,pass_percentage,show_results_after_submit,time_limit_seconds').eq('id', attempt.quiz_id).maybeSingle();
  if (quizError || !quiz) throw new HttpError(404, 'Quiz no longer exists.');

  const { data: questions, error: questionError } = await admin.from('quiz_questions')
    .select('id,question_type,points,sort_order').eq('quiz_id', attempt.quiz_id).eq('is_active', true).order('sort_order');
  if (questionError || !questions?.length) throw new HttpError(500, 'Quiz has no active questions.');
  const timeLimit = Number(quiz.time_limit_seconds ?? 0);
  const elapsedBeforeSubmit = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  if (timeLimit > 0 && elapsedBeforeSubmit > timeLimit + 15) {
    await admin.from('quiz_attempts').update({ status: 'abandoned', submitted_at: new Date().toISOString(), duration_seconds: elapsedBeforeSubmit }).eq('id', attempt.id).eq('user_id', userId).eq('status', 'in_progress');
    throw new HttpError(409, 'The quiz time limit expired. This attempt has been closed.');
  }
  const questionIds = questions.map((question) => question.id);
  const questionIdSet = new Set(questionIds);
  const submittedById = new Map(input.responses.map((item) => [item.questionId, item.response]));
  for (const id of submittedById.keys()) {
    if (!questionIdSet.has(id)) throw new HttpError(400, 'Response contains a question that does not belong to this quiz.');
  }

  const { data: keys, error: keyError } = await admin.rpc('get_quiz_answer_keys', { _question_ids: questionIds });
  if (keyError) throw new HttpError(500, 'Could not load grading keys. Run sql/011_backend_rpc.sql to install the restricted grading RPC.', keyError.message);
  // The RPC returns one private grading-key row per question; make the Map tuple
  // and value types explicit so Map#get retains the database result shape.
  const answerKeys = (keys ?? []) as QuizAnswerKey[];
  const keyByQuestion = new Map<string, QuizAnswerKey>(
    answerKeys.map((key): [string, QuizAnswerKey] => [key.question_id, key]),
  );

  let totalPoints = 0;
  let earnedPoints = 0;
  const graded: GradedResponse[] = [];
  for (const question of questions) {
    const points = Number(question.points);
    totalPoints += points;
    const isAnswered = submittedById.has(question.id);
    const response = isAnswered ? submittedById.get(question.id) : { unanswered: true };
    const answer = keyByQuestion.get(question.id);
    if (!answer) throw new HttpError(500, `A grading key is missing for question ${question.id}.`);
    const correct = isAnswered && gradeAnswer(response, answer.answer_key);
    const awarded = correct ? points : 0;
    earnedPoints += awarded;
    graded.push({
      attempt_id: attempt.id,
      user_id: userId,
      question_id: question.id,
      response,
      is_correct: correct,
      points_awarded: awarded,
      answered_at: new Date().toISOString(),
    });
  }

  const score = totalPoints ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;
  const now = new Date();
  const duration = Math.max(0, Math.floor((now.getTime() - new Date(attempt.started_at).getTime()) / 1000));
  const timezone = await getUserTimeZone(admin, userId);
  const { error: finalizeError } = await admin.rpc('finalize_quiz_attempt', {
    _attempt_id: attempt.id,
    _user_id: userId,
    _total_points: totalPoints,
    _earned_points: earnedPoints,
    _score_percentage: score,
    _duration_seconds: duration,
    _responses: graded.map((row) => ({
      question_id: row.question_id,
      response: row.response,
      is_correct: row.is_correct,
      points_awarded: row.points_awarded,
      answered_at: row.answered_at,
    })),
    _activity_date: localDateKey(now, timezone),
    _study_seconds: Math.min(duration, 7200),
  });
  if (finalizeError) {
    if (finalizeError.code === 'P0002' || finalizeError.message?.includes('already been finalized')) {
      throw new HttpError(409, 'This quiz attempt has already been submitted.');
    }
    throw new HttpError(500, 'Could not save and finalize the quiz attempt. Run sql/011_backend_rpc.sql first.', finalizeError.message);
  }

  const gradedByQuestionId = new Map<string, GradedResponse>(
    graded.map((row): [string, GradedResponse] => [row.question_id, row]),
  );
  const feedback = quiz.show_results_after_submit ? questions.map((question) => {
    const answer = keyByQuestion.get(question.id);
    if (!answer) throw new HttpError(500, `A grading key is missing for question ${question.id}.`);
    const response = gradedByQuestionId.get(question.id);
    return {
      questionId: question.id,
      correct: Boolean(response?.is_correct),
      response: response?.response,
      correctAnswer: answerForLearner(answer.answer_key),
      explanation: explanationText(answer.explanation),
      detailedExplanation: answer.explanation,
      pointsAwarded: Number(response?.points_awarded ?? 0),
      points: Number(question.points),
    };
  }) : [];

  return {
    attemptId: attempt.id,
    scorePercentage: score,
    earnedPoints,
    totalPoints,
    passed: score >= Number(quiz.pass_percentage),
    passPercentage: Number(quiz.pass_percentage),
    durationSeconds: duration,
    feedback,
    showResultsAfterSubmit: quiz.show_results_after_submit,
  };
}
