export const KEEP_SIGNED_IN_COOKIE = 'nihongo-keep-signed-in';
export const KEEP_SIGNED_IN_STORAGE_KEY = 'nihongo:auth:keep-signed-in:v1';
export const PERSISTENT_SESSION_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** Read the login preference saved by the successful sign-in form. */
export function shouldKeepSignedInInBrowser(): boolean {
  try {
    const storedPreference = window.localStorage.getItem(KEEP_SIGNED_IN_STORAGE_KEY);
    if (storedPreference === 'true') return true;
    if (storedPreference === 'false') return false;
  } catch {
    // Fall back to the same-origin preference cookie when storage is unavailable.
  }

  if (typeof document === 'undefined') return false;
  const preference = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(KEEP_SIGNED_IN_COOKIE + '='));
  return preference?.slice(KEEP_SIGNED_IN_COOKIE.length + 1) === 'true';
}

/** Remove only the preference marker; Supabase sign-out is handled separately. */
export function clearKeepSignedInPreferenceInBrowser(): void {
  try {
    window.localStorage.removeItem(KEEP_SIGNED_IN_STORAGE_KEY);
  } catch {
    // Continue with cookie cleanup even when localStorage is unavailable.
  }

  if (typeof document !== 'undefined') {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = KEEP_SIGNED_IN_COOKIE + '=; Max-Age=0; Path=/; SameSite=Lax' + secure;
  }
}
