import test from 'node:test';
import assert from 'node:assert/strict';
import { getDaysUntilJlpt } from '../src/lib/nihongo/jlpt-countdown';

test('JLPT countdown calculates the expected 28 days from 8 November to 6 December 2026', () => {
  const now = new Date('2026-11-08T06:00:00.000Z');
  assert.equal(getDaysUntilJlpt('2026-12-06', now, 'Asia/Kolkata'), 28);
});

test('JLPT countdown changes at midnight in the learner timezone', () => {
  const beforeMidnightInIndia = new Date('2026-11-07T18:29:00.000Z');
  const afterMidnightInIndia = new Date('2026-11-07T18:31:00.000Z');
  assert.equal(getDaysUntilJlpt('2026-12-06', beforeMidnightInIndia, 'Asia/Kolkata'), 29);
  assert.equal(getDaysUntilJlpt('2026-12-06', afterMidnightInIndia, 'Asia/Kolkata'), 28);
});

test('JLPT countdown returns zero on exam day and a negative value after it', () => {
  assert.equal(getDaysUntilJlpt('2026-12-06', new Date('2026-12-05T18:30:00.000Z')), 0);
  assert.equal(getDaysUntilJlpt('2026-12-06', new Date('2026-12-06T18:30:00.000Z')), -1);
});

test('JLPT countdown rejects malformed or impossible exam dates', () => {
  assert.throws(() => getDaysUntilJlpt('06-12-2026'), RangeError);
  assert.throws(() => getDaysUntilJlpt('2026-02-30'), RangeError);
});
