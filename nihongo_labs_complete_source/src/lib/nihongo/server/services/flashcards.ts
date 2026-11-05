import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmptyCard, fsrs, Rating, State, type Card } from 'ts-fsrs';
import { HttpError } from '../http';
import { getUserTimeZone } from '../activity';
import { localDateKey } from '../date';

type RatingName = 'again' | 'hard' | 'good' | 'easy';
const ratingMap = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy } as const;

function stateToDb(state: State): 'new' | 'learning' | 'review' | 'relearning' {
  if (state === State.Learning) return 'learning';
  if (state === State.Review) return 'review';
  if (state === State.Relearning) return 'relearning';
  return 'new';
}

function stateFromDb(state: string | undefined): State {
  switch (state) {
    case 'learning': return State.Learning;
    case 'review': return State.Review;
    case 'relearning': return State.Relearning;
    default: return State.New;
  }
}

function toSchedulerCard(row: any, now: Date): Card {
  if (!row) return createEmptyCard(now);
  return {
    ...createEmptyCard(now),
    due: new Date(row.due_at),
    stability: Number(row.stability_days ?? 0),
    difficulty: Number(row.difficulty ?? 0),
    elapsed_days: Number(row.elapsed_days ?? 0),
    scheduled_days: Number(row.scheduled_days ?? 0),
    learning_steps: Number(row.learning_step ?? 0),
    reps: Number(row.repetitions ?? 0),
    lapses: Number(row.lapses ?? 0),
    state: stateFromDb(row.scheduler_state),
    last_review: row.last_reviewed_at ? new Date(row.last_reviewed_at) : undefined,
  };
}

export async function createFlashcardSession(userClient: SupabaseClient, admin: SupabaseClient, userId: string, deckId: string, mode: 'new' | 'review' | 'mixed' | 'custom') {
  const { data: deck, error: deckError } = await userClient.from('flashcard_decks')
    .select('id,title,deck_type,jlpt_level,access_level,publication_status,visibility')
    .eq('id', deckId).maybeSingle();
  if (deckError || !deck) throw new HttpError(404, 'Flashcard deck not found or unavailable.');
  const { data: session, error } = await admin.from('flashcard_sessions')
    .insert({ user_id: userId, deck_id: deckId, session_mode: mode })
    .select('id,started_at').single();
  if (error || !session) throw new HttpError(500, 'Could not start flashcard session.', error?.message);
  const { error: savedDeckError } = await admin.from('user_flashcard_decks').upsert({ user_id: userId, deck_id: deckId, status: 'active' }, { onConflict: 'user_id,deck_id', ignoreDuplicates: true });
  if (savedDeckError) throw new HttpError(500, 'Could not save this deck to your library.', savedDeckError.message);
  return { sessionId: session.id, startedAt: session.started_at, deck };
}

export async function getDueFlashcards(userClient: SupabaseClient, userId: string, deckId: string, mode: 'new' | 'review' | 'mixed' | 'custom' = 'mixed') {
  const { data: deck, error: deckError } = await userClient.from('flashcard_decks')
    .select('id,title,description,jlpt_level,access_level,deck_type').eq('id', deckId).maybeSingle();
  if (deckError || !deck) throw new HttpError(404, 'Flashcard deck not found or unavailable.');
  const timezone = await getUserTimeZone(userClient, userId);
  const todayKey = localDateKey(new Date(), timezone);
  const [{ data: settings }, { data: cards, error: cardsError }, { data: states, error: statesError }, { data: activity, error: activityError }] = await Promise.all([
    userClient.from('user_flashcard_settings').select('daily_new_limit,daily_review_limit,desired_retention,show_romaji,show_furigana').eq('user_id', userId).maybeSingle(),
    userClient.from('flashcards').select('id,front_text,back_text,front_reading,back_reading,front_romaji,back_romaji,hint,example_sentence,example_translation,source_type,vocabulary_id,kanji_id,grammar_id,sort_order').eq('deck_id', deckId).eq('is_active', true).order('sort_order').limit(1000),
    userClient.from('flashcard_review_state').select('flashcard_id,scheduler_state,due_at,repetitions,suspended_at,buried_until').eq('user_id', userId).limit(2000),
    userClient.from('user_daily_activity').select('flashcards_reviewed,flashcards_new').eq('user_id', userId).eq('activity_date', todayKey).maybeSingle(),
  ]);
  if (cardsError || statesError || activityError) throw new HttpError(500, 'Could not load flashcards.', cardsError?.message || statesError?.message || activityError?.message);

  const stateById = new Map((states ?? []).map((row: any) => [row.flashcard_id, row]));
  const now = Date.now();
  const currentSettings = settings ?? { daily_new_limit: 20, daily_review_limit: 200, show_romaji: true, show_furigana: true };
  const reviewedToday = Number(activity?.flashcards_reviewed ?? 0);
  const newToday = Number(activity?.flashcards_new ?? 0);
  const reviewQuotaLeft = Math.max(0, Number(currentSettings.daily_review_limit) - Math.max(0, reviewedToday - newToday));
  const newQuotaLeft = Math.max(0, Number(currentSettings.daily_new_limit) - newToday);
  const due = (cards ?? []).filter((card: any) => {
    const state: any = stateById.get(card.id);
    return state && !state.suspended_at && (!state.buried_until || new Date(state.buried_until).getTime() <= now) && new Date(state.due_at).getTime() <= now;
  }).slice(0, reviewQuotaLeft);
  const fresh = (cards ?? []).filter((card: any) => !stateById.has(card.id)).slice(0, newQuotaLeft);
  return { deck, settings: currentSettings, due: mode === 'new' ? [] : due, newCards: mode === 'review' ? [] : fresh, dueCount: mode === 'new' ? 0 : due.length, newCount: mode === 'review' ? 0 : fresh.length, quota: { reviewRemaining: reviewQuotaLeft, newRemaining: newQuotaLeft } };
}

export async function reviewFlashcard(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  input: { flashcardId: string; sessionId: string; rating: RatingName; responseTimeMs?: number },
) {
  const { data: card, error: cardError } = await userClient.from('flashcards')
    .select('id,deck_id,is_active').eq('id', input.flashcardId).eq('is_active', true).maybeSingle();
  if (cardError || !card) throw new HttpError(404, 'Flashcard not found or unavailable.');
  const { data: session, error: sessionError } = await admin.from('flashcard_sessions')
    .select('id,deck_id,user_id,finished_at').eq('id', input.sessionId).eq('user_id', userId).maybeSingle();
  if (sessionError || !session || session.deck_id !== card.deck_id || session.finished_at) throw new HttpError(404, 'Active flashcard session not found.');

  const [{ data: initialState, error: stateError }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from('flashcard_review_state').select('*').eq('user_id', userId).eq('flashcard_id', input.flashcardId).maybeSingle(),
    admin.from('user_flashcard_settings').select('desired_retention,daily_new_limit,daily_review_limit').eq('user_id', userId).maybeSingle(),
  ]);
  if (stateError || settingsError) throw new HttpError(500, 'Could not load flashcard revision state.', stateError?.message || settingsError?.message);

  // Materialize the default `new` state so concurrent first reviews from separate
  // sessions serialize on the same row. The RPC then rejects stale calculations.
  if (!initialState) {
    const { error: initError } = await admin.from('flashcard_review_state')
      .upsert({ user_id: userId, flashcard_id: input.flashcardId }, { onConflict: 'user_id,flashcard_id', ignoreDuplicates: true });
    if (initError) throw new HttpError(500, 'Could not initialize flashcard revision state.', initError.message);
  }
  const { data: state, error: refreshedStateError } = await admin.from('flashcard_review_state')
    .select('*').eq('user_id', userId).eq('flashcard_id', input.flashcardId).single();
  if (refreshedStateError || !state) throw new HttpError(500, 'Could not refresh flashcard revision state.', refreshedStateError?.message);

  const now = new Date();
  const scheduler = fsrs({
    request_retention: Number(settings?.desired_retention ?? 0.9),
    maximum_interval: 36500,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  });
  const before = toSchedulerCard(state, now);
  const next = scheduler.next(before, now, ratingMap[input.rating]);
  const scheduled = next.card;
  const stateAfter = {
    scheduler_state: stateToDb(scheduled.state),
    due_at: scheduled.due.toISOString(),
    stability_days: Number(scheduled.stability ?? 0),
    difficulty: Number(scheduled.difficulty ?? 0),
    elapsed_days: Number(scheduled.elapsed_days ?? 0),
    scheduled_days: Number(scheduled.scheduled_days ?? 0),
    learning_step: Number(scheduled.learning_steps ?? 0),
    repetitions: Number(scheduled.reps ?? 0),
    lapses: Number(scheduled.lapses ?? 0),
    last_rating: input.rating,
    last_reviewed_at: now.toISOString(),
  };
  const timezone = await getUserTimeZone(admin, userId);
  const { data: persisted, error: persistError } = await admin.rpc('persist_flashcard_review', {
    _user_id: userId,
    _flashcard_id: input.flashcardId,
    _session_id: input.sessionId,
    _rating: input.rating,
    _response_time_ms: input.responseTimeMs ?? null,
    _state_before: before,
    _state_after: stateAfter,
    _activity_date: localDateKey(now, timezone),
    _study_seconds: Math.ceil((input.responseTimeMs ?? 0) / 1000),
    _daily_new_limit: Number(settings?.daily_new_limit ?? 20),
    _daily_review_limit: Number(settings?.daily_review_limit ?? 200),
  });
  if (persistError) {
    if (persistError.code === '23505') throw new HttpError(409, 'This card has already been reviewed in the current session.');
    if (persistError.code === '40001') throw new HttpError(409, 'This card was reviewed in another tab. Refresh the queue and try again.');
    if (persistError.code === 'P0001' && persistError.message?.includes('new-card')) throw new HttpError(429, 'You have reached your daily new-card limit.');
    if (persistError.code === 'P0001' && persistError.message?.includes('review limit')) throw new HttpError(429, 'You have reached your daily review limit.');
    throw new HttpError(500, 'Could not atomically save flashcard review and next due date. Run sql/011_backend_rpc.sql first.', persistError.message);
  }
  const result = persisted as { reviewId: string; dueAt: string; schedulerState: string; intervalDays: number };

  return { reviewId: result.reviewId, rating: input.rating, dueAt: result.dueAt, schedulerState: result.schedulerState, intervalDays: result.intervalDays };
}

export async function finishFlashcardSession(admin: SupabaseClient, userId: string, sessionId: string) {
  const { data: session, error } = await admin.from('flashcard_sessions').select('id,started_at,finished_at')
    .eq('id', sessionId).eq('user_id', userId).maybeSingle();
  if (error || !session) throw new HttpError(404, 'Flashcard session not found.');
  if (session.finished_at) return session;
  const { data, error: updateError } = await admin.from('flashcard_sessions').update({ finished_at: new Date().toISOString() })
    .eq('id', sessionId).eq('user_id', userId).select().single();
  if (updateError) throw new HttpError(500, 'Could not finish session.', updateError.message);
  return data;
}
