export type KanjiReviewStatus = {
  kanji_id: string;
  status: string;
};

/**
 * Calculates N5 kanji mastery from the canonical review-state records.
 * Only distinct catalogue characters explicitly marked as known count as complete.
 */
export function calculateKanjiMastery(
  kanjiIds: readonly string[],
  reviewRows: readonly KanjiReviewStatus[],
) {
  const publishedIds = new Set(kanjiIds);
  const knownIds = new Set(
    reviewRows
      .filter((row) => row.status === 'known' && publishedIds.has(row.kanji_id))
      .map((row) => row.kanji_id),
  );
  const total = publishedIds.size;
  const mastered = knownIds.size;

  return {
    total,
    mastered,
    percentage: total ? Math.min(100, Math.round((mastered / total) * 100)) : 0,
  };
}
