import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { shouldLaunchFirstRunTour } from '../src/lib/nihongo/first-run-onboarding';

test('only newly registered accounts with a pending marker receive the first-run tour', () => {
  assert.equal(shouldLaunchFirstRunTour({ nihongo_onboarding: 'pending' }), true);
  assert.equal(shouldLaunchFirstRunTour({ nihongo_onboarding: 'completed' }), false);
  assert.equal(shouldLaunchFirstRunTour({ display_name: 'Learner' }), false);
  assert.equal(shouldLaunchFirstRunTour(null), false);
  assert.equal(shouldLaunchFirstRunTour('pending'), false);
});

test('signup marks the account as pending and the tour records completion on the account', () => {
  const signup = readFileSync(resolve(process.cwd(), 'src/app/actions/auth.ts'), 'utf8');
  const learningApp = readFileSync(resolve(process.cwd(), 'src/components/nihongo/learning-app.tsx'), 'utf8');
  const tour = readFileSync(resolve(process.cwd(), 'src/components/nihongo/first-run-tour.tsx'), 'utf8');

  assert.match(signup, /nihongo_onboarding:\s*'pending'/);
  assert.match(learningApp, /client\.auth\.updateUser\([\s\S]*?nihongo_onboarding:\s*'completed'/);
  assert.match(learningApp, /shouldLaunchFirstRunTour\(user\.user_metadata\)/);
  assert.match(tour, /Skip tour/);
  assert.match(tour, /Finish tour/);
  assert.match(tour, /Go to step/);
});
