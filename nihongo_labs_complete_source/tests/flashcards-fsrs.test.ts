import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs';

test('FSRS schedules a new N5 card and produces a valid future due date', () => {
  const now = new Date('2026-11-05T10:00:00.000Z');
  const scheduler = fsrs({ enable_fuzz: false, enable_short_term: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
  const next = scheduler.next(createEmptyCard(now), now, Rating.Good);
  assert.ok(next.card.due instanceof Date);
  assert.ok(next.card.due.getTime() > now.getTime());
  assert.equal(next.card.reps, 1);
  assert.ok([State.Learning, State.Review].includes(next.card.state));
});

test('FSRS retry after Again remains in a learning/relearning state', () => {
  const now = new Date('2026-11-05T10:00:00.000Z');
  const scheduler = fsrs({ enable_fuzz: false, enable_short_term: true, learning_steps: ['1m', '10m'], relearning_steps: ['10m'] });
  const next = scheduler.next(createEmptyCard(now), now, Rating.Again);
  assert.ok(next.card.due.getTime() > now.getTime());
  assert.ok([State.Learning, State.Relearning].includes(next.card.state));
});
