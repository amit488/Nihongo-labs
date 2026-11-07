import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateKanjiMastery } from '../src/lib/nihongo/server/kanji-progress';

test('kanji mastery counts known cards against the published catalogue', () => {
  const result = calculateKanjiMastery(['一', '二', '三'], [
    { kanji_id: '一', status: 'known' },
    { kanji_id: '二', status: 'learning' },
  ]);

  assert.deepEqual(result, { total: 3, mastered: 1, percentage: 33 });
});

test('kanji mastery counts each known character once and ignores out-of-catalogue rows', () => {
  const result = calculateKanjiMastery(['一', '二'], [
    { kanji_id: '一', status: 'known' },
    { kanji_id: '一', status: 'known' },
    { kanji_id: '二', status: 'learning' },
    { kanji_id: 'N4-only', status: 'known' },
  ]);

  assert.deepEqual(result, { total: 2, mastered: 1, percentage: 50 });
});

test('kanji mastery safely handles an empty published catalogue', () => {
  assert.deepEqual(calculateKanjiMastery([], [{ kanji_id: 'retired', status: 'known' }]), {
    total: 0,
    mastered: 0,
    percentage: 0,
  });
});
