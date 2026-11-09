export const KANA_ATTEMPT_QUESTION_COUNT = 20;
export const KANA_ROTATION_FRESH_COUNT = 13;
export const KANA_QUESTION_BANK_SIZE = 33;

export type KanaQuestionIdentity = { id: string };

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

/**
 * First attempt: 20 at random.
 * Reattempts: up to 13 questions outside the previous set plus enough from
 * the previous set to reach 20. With a 33-question bank, this is exactly 13+7.
 */
export function selectKanaQuestions<T extends KanaQuestionIdentity>(
  questionPool: T[],
  previousQuestionIds: string[],
  random: () => number = Math.random,
): T[] {
  if (questionPool.length < KANA_QUESTION_BANK_SIZE) {
    throw new Error('A Kana difficulty bank must contain at least 33 active questions.');
  }

  if (previousQuestionIds.length === 0) {
    return shuffle(questionPool, random).slice(0, KANA_ATTEMPT_QUESTION_COUNT);
  }

  const previousSet = new Set(previousQuestionIds);
  const outsidePrevious = shuffle(questionPool.filter((question) => !previousSet.has(question.id)), random);
  const insidePrevious = shuffle(questionPool.filter((question) => previousSet.has(question.id)), random);
  const freshSelection = outsidePrevious.slice(0, Math.min(KANA_ROTATION_FRESH_COUNT, outsidePrevious.length));
  const revisitSelection = insidePrevious.slice(0, KANA_ATTEMPT_QUESTION_COUNT - freshSelection.length);
  const selectedSet = new Set([...freshSelection, ...revisitSelection].map((question) => question.id));
  const fillSelection = shuffle(questionPool.filter((question) => !selectedSet.has(question.id)), random)
    .slice(0, KANA_ATTEMPT_QUESTION_COUNT - freshSelection.length - revisitSelection.length);

  return shuffle([...freshSelection, ...revisitSelection, ...fillSelection], random)
    .slice(0, KANA_ATTEMPT_QUESTION_COUNT);
}
