import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const globalController = readFileSync(
  resolve(process.cwd(), 'src/components/nihongo/global-quick-revision.tsx'),
  'utf8',
);
const quickRevision = readFileSync(
  resolve(process.cwd(), 'src/components/nihongo/quick-revision.tsx'),
  'utf8',
);
const quickRevisionApi = readFileSync(
  resolve(process.cwd(), 'src/app/api/learning/quick-revision/route.ts'),
  'utf8',
);
const supabaseServer = readFileSync(
  resolve(process.cwd(), 'src/lib/nihongo/server/supabase.ts'),
  'utf8',
);
const learnerApp = readFileSync(
  resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'),
  'utf8',
);
const adminShell = readFileSync(
  resolve(process.cwd(), 'src/components/nihongo/admin/admin-shell.tsx'),
  'utf8',
);

test('Quick Revision waits for verified auth instead of trusting the initial cookie snapshot', () => {
  assert.match(globalController, /if \(event === 'INITIAL_SESSION'\) return;/);
  assert.match(globalController, /client\.auth\.getUser\(\)/);
  assert.match(globalController, /initialAuthRevision !== authRevision\.current/);
  assert.match(globalController, /authRevision\.current \+= 1/);
});

test('a sign-out invalidates pending auth checks so they cannot re-enable Quick Revision', () => {
  assert.match(globalController, /if \(event === 'SIGNED_OUT'\) \{[\s\S]*?finishSignOut\(\)/);
  assert.match(globalController, /const finishSignOut = \(\) => \{\s*authRevision\.current \+= 1/);
  assert.match(globalController, /if \(alive && initialAuthRevision === authRevision\.current\) finishSignOut\(\)/);
  assert.match(globalController, /window\.addEventListener\('nihongo:auth-signed-out', handleAppSignOut\)/);
});

test('Quick Revision is remounted per authenticated session and hidden when signed out', () => {
  assert.match(globalController, /key=\{signedIn && sessionId \? sessionId : 'signed-out'\}/);
  assert.match(quickRevision, /if \(!signedIn \|\| !sessionId\) return null;/);
});

test('question and answer endpoints remain protected by server-verified Supabase auth', () => {
  assert.match(quickRevisionApi, /const context = await requireUser\(\)/);
  assert.match(supabaseServer, /supabase\.auth\.getUser\(\)/);
  assert.match(supabaseServer, /if \(error \|\| !data\.user\)/);
});


test('anonymous Supabase users cannot activate Quick Revision or access learner endpoints', () => {
  assert.match(globalController, /session\\.user\\?\\.is_anonymous/);
  assert.match(globalController, /!data\\.user \\|\\| data\\.user\\.is_anonymous/);
  assert.match(supabaseServer, /!data\\.user \\|\\| data\\.user\\.is_anonymous/);
});

test('learner and admin logout clear the browser Supabase client session', () => {
  assert.match(learnerApp, /await client\\.auth\\.signOut\\(\\)/);
  assert.match(adminShell, /await client\\.auth\\.signOut\\(\\)/);
  assert.doesNotMatch(learnerApp, /signOutAction/);
  assert.doesNotMatch(adminShell, /signOutAction/);
});
