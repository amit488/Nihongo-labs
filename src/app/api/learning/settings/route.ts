import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { settingsSchema } from '@/lib/nihongo/server/validation';


export async function GET() {
  try {
    await connection();
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const [profile, preferences, flashcards] = await Promise.all([
      context.supabase.from('profiles').select('display_name,timezone,locale,bio').eq('id', context.user.id).maybeSingle(),
      context.supabase.from('user_preferences').select('daily_study_goal_minutes,show_romaji,show_furigana,email_learning_reminders,theme').eq('user_id', context.user.id).maybeSingle(),
      context.supabase.from('user_flashcard_settings').select('daily_new_limit,daily_review_limit,desired_retention,show_romaji,show_furigana,autoplay_audio').eq('user_id', context.user.id).maybeSingle(),
    ]);
    const error = profile.error || preferences.error || flashcards.error;
    if (error) throw new HttpError(500, 'Could not load account settings.', error.message);
    return NextResponse.json({ profile: profile.data, preferences: preferences.data, flashcards: flashcards.data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const input = await readJson(request, settingsSchema);
    if (input.timezone) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }); }
      catch { throw new HttpError(400, 'Timezone must be a valid IANA timezone.'); }
    }
    const profilePatch: Record<string, unknown> = {};
    if (input.displayName !== undefined) profilePatch.display_name = input.displayName;
    if (input.timezone !== undefined) profilePatch.timezone = input.timezone;
    const preferencePatch: Record<string, unknown> = {};
    if (input.dailyStudyGoalMinutes !== undefined) preferencePatch.daily_study_goal_minutes = input.dailyStudyGoalMinutes;
    if (input.showRomaji !== undefined) preferencePatch.show_romaji = input.showRomaji;
    if (input.showFurigana !== undefined) preferencePatch.show_furigana = input.showFurigana;
    const flashcardPatch: Record<string, unknown> = {};
    if (input.showRomaji !== undefined) flashcardPatch.show_romaji = input.showRomaji;
    if (input.showFurigana !== undefined) flashcardPatch.show_furigana = input.showFurigana;

    const results = await Promise.all([
      Object.keys(profilePatch).length ? context.supabase.from('profiles').update(profilePatch).eq('id', context.user.id) : Promise.resolve({ error: null }),
      Object.keys(preferencePatch).length ? context.supabase.from('user_preferences').update(preferencePatch).eq('user_id', context.user.id) : Promise.resolve({ error: null }),
      Object.keys(flashcardPatch).length ? context.supabase.from('user_flashcard_settings').update(flashcardPatch).eq('user_id', context.user.id) : Promise.resolve({ error: null }),
    ]);
    const failure = results.map((result) => result.error).find((error) => error !== null);
    if (failure) throw new HttpError(500, 'Could not save account settings.', failure.message);
    return NextResponse.json({ saved: true });
  } catch (error) { return jsonError(error); }
}
