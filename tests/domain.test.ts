import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, answerForLearner, explanationText } from '../src/lib/nihongo/server/grading';
import { localDateKey, consecutiveStreak, addInterval } from '../src/lib/nihongo/server/date';
import { applyStudyTimeCredit } from '../src/lib/nihongo/activity-snapshot';

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

test('applyStudyTimeCredit updates an existing local activity day without changing other days', () => {
  const snapshot = {
    displayName: 'Learner', preferredJlptLevel: 'N5' as const,
    grammarCount: 0, grammarUnderstood: 0, vocabularyCount: 0, vocabularyMastered: 0, kanjiCount: 0, kanjiMastered: 0,
    grammarAttempts: 0, kanaAttempts: 0, readingAttempts: 0,
    activeDays: ['2026-11-08', '2026-11-07'], lessonsCompleted: 0, lessonsTotal: 0, recentScores: [],
    overallPercentage: 0,
    mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
    streak: 2, due: { vocabulary: 0, flashcards: 0, total: 0 },
    dailyGoal: { minutes: 15, studiedSeconds: 60 }, totalStudySeconds: 3600,
    premiumActive: false, showRomaji: true, showFurigana: true,
    recentActivity: [
      { activity_date: '2026-11-08', study_seconds: 60 },
      { activity_date: '2026-11-07', study_seconds: 120 },
    ],
    source: 'database' as const,
  };
  const updated = applyStudyTimeCredit(snapshot, '2026-11-08', 30);
  assert.equal(updated.dailyGoal.studiedSeconds, 90);
  assert.equal(updated.totalStudySeconds, 3630);
  assert.deepEqual(updated.recentActivity, [
    { activity_date: '2026-11-08', study_seconds: 90 },
    { activity_date: '2026-11-07', study_seconds: 120 },
  ]);
  assert.equal(snapshot.dailyGoal.studiedSeconds, 60, 'the original snapshot is not mutated');
});

test('applyStudyTimeCredit starts a new local activity day and rejects invalid credits', () => {
  const snapshot = {
    displayName: 'Learner', preferredJlptLevel: 'N5' as const,
    grammarCount: 0, grammarUnderstood: 0, vocabularyCount: 0, vocabularyMastered: 0, kanjiCount: 0, kanjiMastered: 0,
    grammarAttempts: 0, kanaAttempts: 0, readingAttempts: 0,
    activeDays: ['2026-11-07'], lessonsCompleted: 0, lessonsTotal: 0, recentScores: [],
    overallPercentage: 0,
    mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
    streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 },
    dailyGoal: { minutes: 15, studiedSeconds: 600 }, totalStudySeconds: 600,
    premiumActive: false, showRomaji: true, showFurigana: true,
    recentActivity: [{ activity_date: '2026-11-07', study_seconds: 600 }],
    source: 'database' as const,
  };
  const updated = applyStudyTimeCredit(snapshot, '2026-11-08', 30);
  assert.equal(updated.dailyGoal.studiedSeconds, 30);
  assert.deepEqual(updated.activeDays, ['2026-11-08', '2026-11-07']);
  assert.equal(updated.totalStudySeconds, 630);
  assert.equal(applyStudyTimeCredit(snapshot, 'bad-date', 30), snapshot);
  assert.equal(applyStudyTimeCredit(snapshot, '2026-11-08', 0), snapshot);
});
