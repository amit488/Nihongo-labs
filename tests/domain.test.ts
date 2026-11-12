import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, answerForLearner, explanationText } from '../src/lib/nihongo/server/grading';
import { localDateKey, consecutiveStreak, addInterval } from '../src/lib/nihongo/server/date';

test('gradeAnswer normalizes full-width and half-width Japanese text', () => {
  assert.equal(gradeAnswer(' ｶﾞｯｺｳ ', 'ガッコウ'), true);
  assert.equal(gradeAnswer('  Watashi   WA ', 'watashi wa'), true);
});

test('gradeAnswer supports accepted alternatives and option keys', () => {
  assert.equal(gradeAnswer('ません', { accepted: ['ません', 'ないです'] }), true);
  assert.equal(gradeAnswer('B', { option_key: 'B' }), true);
  assert.equal(gradeAnswer('A', { option_key: 'B' }), false);
});

test('gradeAnswer respects ordered and unordered arrays', () => {
  assert.equal(gradeAnswer(['A', 'B', 'C'], { sequence: ['A', 'B', 'C'] }), true);
  assert.equal(gradeAnswer(['C', 'B', 'A'], { sequence: ['A', 'B', 'C'] }), false);
  assert.equal(gradeAnswer(['A', 'B'], { accepted: ['A', 'B'] }), true);
  assert.equal(gradeAnswer(['B', 'A'], { accepted: ['A', 'B'], ordered: false }), true);
});

test('answerForLearner and explanationText provide safe display values', () => {
  assert.deepEqual(answerForLearner({ accepted: ['です', 'だ'] }), ['です', 'だ']);
  assert.equal(explanationText({ explanation: 'は marks the topic.' }), 'は marks the topic.');
  assert.match(explanationText(null), /Review the grammar rule/);
});

test('localDateKey respects the learner timezone', () => {
  const instant = new Date('2026-11-05T18:45:00.000Z');
  assert.equal(localDateKey(instant, 'Asia/Kolkata'), '2026-11-06');
  assert.equal(localDateKey(instant, 'UTC'), '2026-11-05');
});

test('consecutiveStreak counts through today or starts from yesterday', () => {
  assert.equal(consecutiveStreak(['2026-11-05', '2026-11-04', '2026-11-03'], '2026-11-05'), 3);
  assert.equal(consecutiveStreak(['2026-11-04', '2026-11-03'], '2026-11-05'), 2);
  assert.equal(consecutiveStreak(['2026-11-01'], '2026-11-05'), 0);
});

test('addInterval handles calendar periods and lifetime', () => {
  assert.equal(addInterval(new Date('2026-01-15T00:00:00.000Z'), 'month')?.toISOString(), '2026-02-15T00:00:00.000Z');
  assert.equal(addInterval(new Date('2026-01-15T00:00:00.000Z'), 'year')?.toISOString(), '2027-01-15T00:00:00.000Z');
  assert.equal(addInterval(new Date('2026-01-15T00:00:00.000Z'), 'lifetime'), null);
});
