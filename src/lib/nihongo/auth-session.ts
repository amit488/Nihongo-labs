export const KEEP_SIGNED_IN_COOKIE_NAME = 'nihongo_keep_signed_in';
export const KEEP_SIGNED_IN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const TAB_SESSION_STORAGE_KEY = 'nihongo:auth:tab-session:v1';

type CookiePersistenceOptions = {
  maxAge?: number;
  expires?: Date;
};

/**
 * Supabase SSR defaults auth cookies to a persistent lifetime. Override that
 * default when "Keep me signed in" is unchecked so the browser uses session
 * cookies instead. Deletion cookies must keep their zero-age semantics.
 */
export function withAuthCookiePersistence<T extends CookiePersistenceOptions>(
  options: T,
  keepSignedIn: boolean,
  value?: string,
): T {
  const next = { ...options };
  const isDeletion = next.maxAge === 0 || value === '';

  if (isDeletion) return next;

  if (keepSignedIn) {
    next.maxAge = KEEP_SIGNED_IN_MAX_AGE_SECONDS;
    delete next.expires;
  } else {
    delete next.maxAge;
    delete next.expires;
  }

  return next;
}
