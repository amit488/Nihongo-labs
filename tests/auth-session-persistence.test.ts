import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  KEEP_SIGNED_IN_MAX_AGE_SECONDS,
  withAuthCookiePersistence,
} from '../src/lib/nihongo/auth-session';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

test('auth cookies are session-only unless Keep me signed in is selected', () => {
  const defaultCookie = {
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
    expires: new Date('2030-01-01T00:00:00.000Z'),
  };

  const sessionCookie = withAuthCookiePersistence(defaultCookie, false);
  assert.equal(sessionCookie.maxAge, undefined);
  assert.equal(sessionCookie.expires, undefined);

  const rememberedCookie = withAuthCookiePersistence(defaultCookie, true);
  assert.equal(rememberedCookie.maxAge, KEEP_SIGNED_IN_MAX_AGE_SECONDS);
  assert.equal(rememberedCookie.expires, undefined);

  const removalCookie = withAuthCookiePersistence({ path: '/', maxAge: 0 }, true, '');
  assert.equal(removalCookie.maxAge, 0);
});

test('login exposes the Keep me signed in option and submits it to the server action', () => {
  const form = read('src/components/nihongo/auth-form.tsx');
  const action = read('src/app/actions/auth.ts');
  assert.match(form, /type="checkbox" name="keepSignedIn"/);
  assert.match(form, /Keep me signed in/);
  assert.match(action, /formData\.get\('keepSignedIn'\) === 'on'/);
  assert.match(action, /createServerSupabase\(\{ keepSignedIn \}\)/);
  assert.match(form, /window\.location\.assign/);
});

test('server, proxy and browser Supabase clients apply the same cookie lifetime', () => {
  const server = read('src/lib/nihongo/server/supabase.ts');
  const proxy = read('src/proxy.ts');
  const browser = read('src/lib/nihongo/supabase.ts');
  assert.match(server, /withAuthCookiePersistence\(options, keepSignedIn, value\)/);
  assert.match(proxy, /withAuthCookiePersistence\(options, keepSignedIn, value\)/);
  assert.match(browser, /serializeCookieHeader/);
  assert.match(browser, /withAuthCookiePersistence\(options, keepSignedIn, value\)/);
  assert.match(browser, /clearKeepSignedInPreference/);
});

test('a new website visit receives a fresh timer session while tab switching can pause and resume', () => {
  const controller = read('src/components/nihongo/global-quick-revision.tsx');
  const timer = read('src/components/nihongo/quick-revision.tsx');
  assert.match(controller, /sessionStorage\.getItem\(TAB_SESSION_STORAGE_KEY\)/);
  assert.match(controller, /existing\.tabSessionId === tabSessionId/);
  assert.match(controller, /window\.sessionStorage\.removeItem\(TAB_SESSION_STORAGE_KEY\)/);
  assert.match(controller, /window\.localStorage\.removeItem\(TIMER_STORAGE_KEY\)/);
  assert.match(timer, /document\.visibilityState === 'visible' && document\.hasFocus\(\)/);
  assert.match(timer, /document\.addEventListener\('visibilitychange', handleEligibilityChange\)/);
});

test('closing the website signs out non-remembered sessions after pending study-time flushes', () => {
  const controller = read('src/components/nihongo/global-quick-revision.tsx');
  const learning = read('src/components/nihongo/learning-app.tsx');
  const route = read('src/app/api/auth/session/route.ts');
  assert.match(controller, /if \(!signedInRef\.current \|\| hasKeepSignedInPreference\(\)\) return/);
  assert.match(controller, /Promise\.allSettled\(pendingFlushes\)/);
  assert.match(controller, /fetch\('\/api\/auth\/session'/);
  assert.match(learning, /nihongo:prepare-session-end/);
  assert.match(learning, /flushCurrentStudyTime/);
  assert.match(route, /supabase\.auth\.signOut\(\)/);
  assert.match(route, /KEEP_SIGNED_IN_COOKIE_NAME/);
});

test('explicit learner sign-out flushes study time before clearing Supabase auth', () => {
  const learning = read('src/components/nihongo/learning-app.tsx');
  const signOutStart = learning.indexOf('async function signOut()');
  const flush = learning.indexOf('await flushStudyTime()', signOutStart);
  const signOut = learning.indexOf('client.auth.signOut()', signOutStart);
  assert.ok(signOutStart >= 0 && flush > signOutStart && signOut > flush);
  assert.match(learning, /clearKeepSignedInPreference\(\)/);
});
