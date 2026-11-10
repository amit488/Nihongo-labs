import { getSupabaseBrowserClient } from './supabase';
import { grammar, kanji, vocabulary, type VocabularyItem } from './demo-content';

export type LearnerSnapshot = {
  displayName: string;
  timeZone?: string;
  preferredJlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  grammarCount: number;
  grammarUnderstood: number;
  vocabularyCount: number;
  vocabularyMastered: number;
  kanjiCount: number;
  kanjiMastered: number;
  grammarAttempts: number;
  kanaAttempts: number;
  readingAttempts: number;
  activeDays: string[];
  lessonsCompleted: number;
  lessonsTotal: number;
  recentScores: number[];
  overallPercentage: number;
  mastery: { grammar: number; vocabulary: number; kanji: number; kana: number; reading: number; overallLessons: number };
  streak: number;
  due: { vocabulary: number; flashcards: number; total: number };
  dailyGoal: { minutes: number; studiedSeconds: number };
  totalStudySeconds: number;
  premiumActive: boolean;
  showRomaji: boolean;
  showFurigana: boolean;
  recentActivity: Array<{ activity_date: string; study_seconds: number }>;
  source: 'database' | 'preview';
};

type DashboardResponse = {
  profile?: { displayName?: string | null; timezone?: string | null };
  progress?: {
    grammarTotal?: number | null; grammarUnderstood?: number | null;
    vocabularyTotal?: number | null; vocabularyMastered?: number | null;
    kanjiTotal?: number | null; kanjiMastered?: number | null;
    grammarAttempts?: number | null; kanaAttempts?: number | null; readingAttempts?: number | null;
    lessonsCompleted?: number | null; lessonsTotal?: number | null; overallPercentage?: number | null;
    mastery?: LearnerSnapshot['mastery'];
  };
  recentActivity?: LearnerSnapshot['recentActivity'];
  recentAttempts?: Array<{ score_percentage?: number | null }>;
  streak?: number | null;
  due?: LearnerSnapshot['due'];
  dailyGoal?: LearnerSnapshot['dailyGoal'];
  totalStudySeconds?: number | null;
  preferences?: { preferred_jlpt_level?: LearnerSnapshot['preferredJlptLevel'] | null; show_romaji?: boolean | null; show_furigana?: boolean | null } | null;
  flashcardSettings?: { show_romaji?: boolean | null; show_furigana?: boolean | null } | null;
};
type BillingStatusResponse = { hasPremium?: boolean };
type ContentResponse<T> = { items: T[] };
type VocabularyContentRow = {
  id: string; word: string; kana: string; romaji: string | null; meaning: string;
  part_of_speech: string | null; example_sentence: string | null;
  example_reading: string | null; example_translation: string | null;
};
type KanjiExampleWord = { word?: string; vocabulary?: string; meaning?: string; translation?: string };
type KanjiContentRow = {
  id: string; character: string; meaning: string; on_yomi: string[] | null; kun_yomi: string[] | null;
  stroke_count: number | null; radical: string | null; example_words: KanjiExampleWord[] | null;
};
type GrammarExampleRow = { japanese?: string; sentence?: string; romaji?: string; meaning?: string; translation?: string };
type GrammarContentRow = {
  id: string; title: string; pattern: string; explanation: string;
  formation: string | null; examples: GrammarExampleRow[] | null;
};
type FlashcardContentRow = {
  id: string; deckId: string; deckTitle: string; deckSlug: string;
  front_text: string; front_reading: string | null; front_romaji: string | null;
  back_text: string; back_reading: string | null; back_romaji: string | null;
  example_sentence: string | null; example_translation: string | null; hint: string | null;
};
export type ReadingPassage = {
  title: string; text: string; romaji?: string; translation?: string;
  vocabulary?: Array<{ word: string; reading: string; meaning: string; romaji?: string }>;
  [key: string]: unknown;
};

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

const previewSnapshot = (): LearnerSnapshot => ({
  displayName: 'Learner', timeZone: 'Asia/Kolkata', preferredJlptLevel: 'N5',
  grammarCount: grammar.length, grammarUnderstood: 0,
  vocabularyCount: vocabulary.length, vocabularyMastered: 0,
  kanjiCount: kanji.length, kanjiMastered: 0,
  grammarAttempts: 0, kanaAttempts: 0, readingAttempts: 0,
  activeDays: [], lessonsCompleted: 0, lessonsTotal: 0, recentScores: [], overallPercentage: 0,
  mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
  streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 }, dailyGoal: { minutes: 15, studiedSeconds: 0 }, totalStudySeconds: 0, premiumActive: false, showRomaji: true, showFurigana: true, recentActivity: [], source: 'preview',
});

export async function loadLearnerSnapshot(user?: { email?: string | null } | null): Promise<LearnerSnapshot> {
  const client = getSupabaseBrowserClient();
  if (!client) return previewSnapshot();
  const resolvedUser = user === undefined ? (await client.auth.getUser()).data.user : user;
  if (!resolvedUser) return previewSnapshot();
  const [dashboard, billing] = await Promise.all([
    apiGet<DashboardResponse>('/api/learning/dashboard'),
    apiGet<BillingStatusResponse>('/api/billing/status').catch(() => ({ hasPremium: false })),
  ]);
  return {
    displayName: dashboard.profile?.displayName || resolvedUser.email?.split('@')[0] || 'Learner',
    timeZone: dashboard.profile?.timezone || 'Asia/Kolkata',
    preferredJlptLevel: dashboard.preferences?.preferred_jlpt_level ?? 'N5',
    grammarCount: Number(dashboard.progress?.grammarTotal ?? 0),
    grammarUnderstood: Number(dashboard.progress?.grammarUnderstood ?? 0),
    vocabularyCount: Number(dashboard.progress?.vocabularyTotal ?? 0),
    vocabularyMastered: Number(dashboard.progress?.vocabularyMastered ?? 0),
    kanjiCount: Number(dashboard.progress?.kanjiTotal ?? 0),
    kanjiMastered: Number(dashboard.progress?.kanjiMastered ?? 0),
    grammarAttempts: Number(dashboard.progress?.grammarAttempts ?? 0),
    kanaAttempts: Number(dashboard.progress?.kanaAttempts ?? 0),
    readingAttempts: Number(dashboard.progress?.readingAttempts ?? 0),
    activeDays: (dashboard.recentActivity ?? []).map((row) => String(row.activity_date)),
    lessonsCompleted: Number(dashboard.progress?.lessonsCompleted ?? 0),
    lessonsTotal: Number(dashboard.progress?.lessonsTotal ?? 0),
    recentScores: (dashboard.recentAttempts ?? []).map((row) => Number(row.score_percentage ?? 0)).reverse(),
    overallPercentage: Number(dashboard.progress?.overallPercentage ?? 0),
    mastery: dashboard.progress?.mastery ?? previewSnapshot().mastery,
    streak: Number(dashboard.streak ?? 0),
    due: dashboard.due ?? { vocabulary: 0, flashcards: 0, total: 0 },
    dailyGoal: dashboard.dailyGoal ?? { minutes: 15, studiedSeconds: 0 },
    totalStudySeconds: Number(dashboard.totalStudySeconds ?? 0),
    premiumActive: Boolean(billing.hasPremium),
    showRomaji: Boolean(dashboard.preferences?.show_romaji ?? dashboard.flashcardSettings?.show_romaji ?? true),
    showFurigana: Boolean(dashboard.preferences?.show_furigana ?? dashboard.flashcardSettings?.show_furigana ?? true),
    recentActivity: dashboard.recentActivity ?? [],
    source: 'database',
  };
}

export type VocabularyPage = { items: VocabularyItem[]; hasMore: boolean; nextOffset: number };

export async function getPublishedVocabulary(
  level: 'N5' | 'N4' = 'N5',
  offset = 0,
  limit = 80,
  search = '',
): Promise<VocabularyPage> {
  const params = new URLSearchParams({
    kind: 'vocabulary',
    level,
    offset: String(Math.max(0, offset)),
    limit: String(Math.min(100, Math.max(1, limit))),
  });
  if (search.trim()) params.set('q', search.trim());

  try {
    const response = await apiGet<ContentResponse<VocabularyContentRow> & { hasMore?: boolean; nextOffset?: number }>(
      `/api/learning/content?${params.toString()}`,
    );
    const rows = response.items ?? [];
    return {
      items: rows.map((row) => ({
        id: row.id, word: row.word, kana: row.kana, romaji: row.romaji || '', meaning: row.meaning,
        partOfSpeech: row.part_of_speech || 'Word', example: row.example_sentence || '',
        exampleRomaji: row.example_reading || '', exampleMeaning: row.example_translation || '',
      })),
      hasMore: Boolean(response.hasMore),
      nextOffset: Number(response.nextOffset ?? offset + rows.length),
    };
  } catch {
    const fallback = offset === 0 && level === 'N5' && !search.trim() ? vocabulary.slice(0, limit) : [];
    return { items: fallback, hasMore: false, nextOffset: offset + fallback.length };
  }
}

export async function getPublishedVocabularyById(
  id: string,
  level: 'N5' | 'N4' = 'N5',
): Promise<VocabularyItem | null> {
  if (!id) return null;
  const params = new URLSearchParams({ kind: 'vocabulary', level, id });
  try {
    const response = await apiGet<ContentResponse<VocabularyContentRow>>(
      `/api/learning/content?${params.toString()}`,
    );
    const row = response.items?.[0];
    if (!row) return null;
    return {
      id: row.id, word: row.word, kana: row.kana, romaji: row.romaji || '', meaning: row.meaning,
      partOfSpeech: row.part_of_speech || 'Word', example: row.example_sentence || '',
      exampleRomaji: row.example_reading || '', exampleMeaning: row.example_translation || '',
    };
  } catch {
    return null;
  }
}

export async function getPublishedKanji(level: 'N5' | 'N4' = 'N5') {
  try {
    const { items } = await apiGet<ContentResponse<KanjiContentRow>>(`/api/learning/content?kind=kanji&level=${level}&limit=250`);
    if (!items.length) return level === 'N5' ? kanji : [];
    return items.map((row) => {
      const first = Array.isArray(row.example_words) ? row.example_words[0] : {};
      return {
        id: row.id, character: row.character, meaning: row.meaning,
        onYomi: row.on_yomi || [], kunYomi: row.kun_yomi || [], strokes: row.stroke_count || 0,
        radical: row.radical || '', example: first?.word || first?.vocabulary || '',
        exampleMeaning: first?.meaning || first?.translation || '',
      };
    });
  } catch { return level === 'N5' ? kanji : []; }
}
export async function getPublishedGrammar(level: 'N5' | 'N4' = 'N5') {
  try {
    const { items } = await apiGet<ContentResponse<GrammarContentRow>>(`/api/learning/content?kind=grammar&level=${level}&limit=250`);
    if (!items.length) return level === 'N5' ? grammar : [];
    return items.map((row) => ({
      id: row.id, title: row.title, pattern: row.pattern, explanation: row.explanation,
      formation: row.formation || '', category: 'Grammar', difficulty: 'Core' as const,
      examples: Array.isArray(row.examples) ? row.examples.map((item) => ({
        japanese: item.japanese || item.sentence || '', romaji: item.romaji || '', meaning: item.meaning || item.translation || '',
      })) : [],
    }));
  } catch { return level === 'N5' ? grammar : []; }
}

export type LearnerFlashcard = {
  id: string;
  deckId: string;
  deckTitle: string;
  deckSlug: string;
  front: string;
  reading: string;
  romaji: string;
  back: string;
  backReading: string;
  backRomaji: string;
  example: string;
  meaning: string;
  hint: string;
};

export async function getPublishedFlashcards(level: 'N5' | 'N4' = 'N5'): Promise<LearnerFlashcard[]> {
  try {
    const { items } = await apiGet<ContentResponse<FlashcardContentRow>>(`/api/learning/content?kind=flashcards&level=${level}&limit=20`);
    return items.map((card) => ({
      id: card.id, deckId: card.deckId, deckTitle: card.deckTitle, deckSlug: card.deckSlug,
      front: card.front_text, reading: card.front_reading || '', romaji: card.front_romaji || '',
      back: card.back_text, backReading: card.back_reading || '', backRomaji: card.back_romaji || '',
      example: card.example_sentence || '', meaning: card.example_translation || '', hint: card.hint || '',
    }));
  } catch { return []; }
}

export async function getReadingPassages(level: 'N5' | 'N4' = 'N5'): Promise<ReadingPassage[]> {
  try { return (await apiGet<ContentResponse<ReadingPassage>>(`/api/learning/content?kind=reading&level=${level}&limit=50`)).items; }
  catch { return []; }
}
