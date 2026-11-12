import { connection, NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/nihongo/server/supabase';
import { assertSameOrigin, HttpError, jsonError, readJson } from '@/lib/nihongo/server/http';
import { settingsSchema } from '@/lib/nihongo/server/validation';


export async function GET() {
  await connection();
  try {
    const context = await requireUser();
    if (!context.ok) throw new HttpError(401, context.error);
    const [profile, preferences, flashcards] = await Promise.all([
      context.supabase.from('profiles').select('display_name,timezone,locale,bio').eq('id', context.user.id).maybeSingle(),
      context.supabase.from('user_preferences').select('daily_study_goal_minutes,preferred_jlpt_level,show_romaji,show_furigana,email_learning_reminders,theme').eq('user_id', context.user.id).maybeSingle(),
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
    if (input.preferredJlptLevel !== undefined) preferencePatch.preferred_jlpt_level = input.preferredJlptLevel;
    if (input.showRomaji !== undefined) preferencePatch.show_romaji = input.showRomaji;
    if (input.showFurigana !== undefined) preferencePatch.show_furigana = input.showFurigana;
    const flashcardPatch: Record<string, unknown> = {};
    if (input.showRomaji !== undefined) flashcardPatch.show_romaji = input.showRomaji;
    if (input.showFurigana !== undefined) flashcardPatch.show_furigana = input.showFurigana;

    const { error } = await context.supabase.rpc('update_learning_settings', {
      _user_id: context.user.id,
      _profile_patch: profilePatch,
      _preferences_patch: preferencePatch,
      _flashcards_patch: flashcardPatch,
    });
    if (error) throw new HttpError(500, 'Could not save account settings.', error.message);
    return NextResponse.json({ saved: true });
  } catch (error) { return jsonError(error); }
}
