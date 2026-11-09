import assert from 'node:assert/strict';
import test from 'node:test';
import { KANA_ATTEMPT_QUESTION_COUNT, KANA_ROTATION_FRESH_COUNT, selectKanaQuestions } from '../src/lib/nihongo/kana-rotation';

const pool = Array.from({ length: 33 }, (_, index) => ({ id: `kana-${index + 1}` }));
const deterministicRandom = () => 0.37;

test('first Kana attempt draws 20 unique questions from the 33-question bank', () => {
  const selected = selectKanaQuestions(pool, [], deterministicRandom);
  assert.equal(selected.length, KANA_ATTEMPT_QUESTION_COUNT);
  assert.equal(new Set(selected.map((question) => question.id)).size, KANA_ATTEMPT_QUESTION_COUNT);
});

test('first reattempt contains all 13 unseen questions and 7 from the previous set', () => {
  const first = selectKanaQuestions(pool, [], deterministicRandom);
  const firstIds = first.map((question) => question.id);
  const retry = selectKanaQuestions(pool, firstIds, deterministicRandom);
  const retryIds = retry.map((question) => question.id);
  const previous = new Set(firstIds);

  assert.equal(retry.length, KANA_ATTEMPT_QUESTION_COUNT);
  assert.equal(new Set(retryIds).size, KANA_ATTEMPT_QUESTION_COUNT);
  assert.equal(retryIds.filter((id) => !previous.has(id)).length, KANA_ROTATION_FRESH_COUNT);
  assert.equal(retryIds.filter((id) => previous.has(id)).length, 7);
});

test('subsequent reattempts rotate outside the most recent set plus 7 recent questions', () => {
  const first = selectKanaQuestions(pool, [], deterministicRandom);
  const second = selectKanaQuestions(pool, first.map((question) => question.id), deterministicRandom);
  const secondIds = second.map((question) => question.id);
  const third = selectKanaQuestions(pool, secondIds, deterministicRandom);
  const previous = new Set(secondIds);
  const thirdIds = third.map((question) => question.id);

  assert.equal(third.length, KANA_ATTEMPT_QUESTION_COUNT);
  assert.equal(new Set(thirdIds).size, KANA_ATTEMPT_QUESTION_COUNT);
  assert.equal(thirdIds.filter((id) => !previous.has(id)).length, KANA_ROTATION_FRESH_COUNT);
  assert.equal(thirdIds.filter((id) => previous.has(id)).length, 7);
});

test('selection rejects a bank that does not have all 33 questions', () => {
  assert.throws(() => selectKanaQuestions(pool.slice(0, 32), [], deterministicRandom), /33 active questions/);
});
