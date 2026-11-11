type SentenceIdentity = { id: string };

/** Returns the earliest question that has not been answered correctly yet. */
export function findFirstUnsolvedSentenceIndex(
  items: readonly SentenceIdentity[],
  solvedSentenceIds: Iterable<string>,
): number | null {
  const solved = new Set(solvedSentenceIds);
  const index = items.findIndex((item) => !solved.has(item.id));
  return index === -1 ? null : index;
}

/** Advances to the next unsolved question, skipping any completed questions. */
export function findNextUnsolvedSentenceIndex(
  items: readonly SentenceIdentity[],
  solvedSentenceIds: Iterable<string>,
  currentIndex: number,
): number | null {
  if (items.length === 0) return null;
  const solved = new Set(solvedSentenceIds);
  const normalizedCurrentIndex = ((currentIndex % items.length) + items.length) % items.length;

  for (let offset = 1; offset <= items.length; offset += 1) {
    const candidateIndex = (normalizedCurrentIndex + offset) % items.length;
    if (!solved.has(items[candidateIndex].id)) return candidateIndex;
  }

  return null;
}
