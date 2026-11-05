import { getSupabaseBrowserClient } from './supabase';
import { grammar, kanji, vocabulary } from './demo-content';

export type LearnerSnapshot = {
  displayName: string;
  grammarCount: number;
  vocabularyCount: number;
  kanjiCount: number;
  activeDays: string[];
  lessonsCompleted: number;
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

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

const previewSnapshot = (): LearnerSnapshot => ({
  displayName: 'Learner', grammarCount: grammar.length, vocabularyCount: vocabulary.length, kanjiCount: kanji.length,
  activeDays: [], lessonsCompleted: 0, recentScores: [], overallPercentage: 0,
  mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
  streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 }, dailyGoal: { minutes: 15, studiedSeconds: 0 }, totalStudySeconds: 0, premiumActive: false, showRomaji: true, showFurigana: true, recentActivity: [], source: 'preview',
});

export async function loadLearnerSnapshot(): Promise<LearnerSnapshot> {
  const client = getSupabaseBrowserClient();
  if (!client) return previewSnapshot();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return previewSnapshot();
  const [dashboard, billing] = await Promise.all([
    apiGet<any>('/api/learning/dashboard'),
    apiGet<any>('/api/billing/status').catch(() => ({ hasPremium: false })),
  ]);
  return {
    displayName: dashboard.profile?.displayName || user.email?.split('@')[0] || 'Learner',
    grammarCount: Number(dashboard.progress?.grammarTotal ?? 0),
    vocabularyCount: Number(dashboard.progress?.vocabularyTotal ?? 0),
    kanjiCount: Number(dashboard.progress?.kanjiTotal ?? 0),
    activeDays: (dashboard.recentActivity ?? []).map((row: any) => String(row.activity_date)),
    lessonsCompleted: Number(dashboard.progress?.lessonsCompleted ?? 0),
    recentScores: (dashboard.recentAttempts ?? []).map((row: any) => Number(row.score_percentage ?? 0)).reverse(),
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

export async function getPublishedVocabulary() {
  try {
    const { items } = await apiGet<{ items: any[] }>('/api/learning/content?kind=vocabulary&level=N5&limit=250');
    if (!items.length) return vocabulary;
    return items.map((row) => ({
      id: row.id, word: row.word, kana: row.kana, romaji: row.romaji || '', meaning: row.meaning,
      partOfSpeech: row.part_of_speech || 'Word', example: row.example_sentence || '',
      exampleRomaji: row.example_reading || '', exampleMeaning: row.example_translation || '',
    }));
  } catch { return vocabulary; }
}

export async function getPublishedKanji() {
  try {
    const { items } = await apiGet<{ items: any[] }>('/api/learning/content?kind=kanji&level=N5&limit=250');
    if (!items.length) return kanji;
    return items.map((row) => {
      const first = Array.isArray(row.example_words) ? row.example_words[0] : {};
      return {
        id: row.id, character: row.character, meaning: row.meaning,
        onYomi: row.on_yomi || [], kunYomi: row.kun_yomi || [], strokes: row.stroke_count || 0,
        radical: row.radical || '', example: first?.word || first?.vocabulary || '',
        exampleMeaning: first?.meaning || first?.translation || '',
      };
    });
  } catch { return kanji; }
}

export async function getPublishedGrammar() {
  try {
    const { items } = await apiGet<{ items: any[] }>('/api/learning/content?kind=grammar&level=N5&limit=250');
    if (!items.length) return grammar;
    return items.map((row) => ({
      id: row.id, title: row.title, pattern: row.pattern, explanation: row.explanation,
      formation: row.formation || '', category: 'Grammar', difficulty: 'Core' as const,
      examples: Array.isArray(row.examples) ? row.examples.map((item: any) => ({
        japanese: item.japanese || item.sentence || '', romaji: item.romaji || '', meaning: item.meaning || item.translation || '',
      })) : [],
    }));
  } catch { return grammar; }
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

export async function getPublishedFlashcards(): Promise<LearnerFlashcard[]> {
  try {
    const { items } = await apiGet<{ items: any[] }>('/api/learning/content?kind=flashcards&level=N5&limit=20');
    return items.map((card) => ({
      id: card.id, deckId: card.deckId, deckTitle: card.deckTitle, deckSlug: card.deckSlug,
      front: card.front_text, reading: card.front_reading || '', romaji: card.front_romaji || '',
      back: card.back_text, backReading: card.back_reading || '', backRomaji: card.back_romaji || '',
      example: card.example_sentence || '', meaning: card.example_translation || '', hint: card.hint || '',
    }));
  } catch { return []; }
}

export async function getReadingPassages() {
  try { return (await apiGet<{ items: any[] }>('/api/learning/content?kind=reading&level=N5&limit=50')).items; }
  catch { return []; }
}
