import assert from 'node:assert/strict';
import testCase from 'node:test';
import {
  findFirstUnsolvedSentenceIndex,
  findNextUnsolvedSentenceIndex,
} from '../src/lib/nihongo/sentence-construction-progress';

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

testCase('sentence construction resumes at the first unsolved question', () => {
  assert.equal(findFirstUnsolvedSentenceIndex(items, []), 0);
  assert.equal(findFirstUnsolvedSentenceIndex(items, ['a', 'b', 'c']), 3);
});

testCase('sentence construction returns null when every question is solved', () => {
  assert.equal(findFirstUnsolvedSentenceIndex(items, ['a', 'b', 'c', 'd']), null);
  assert.equal(findFirstUnsolvedSentenceIndex([], []), null);
});

testCase('next sentence skips completed questions', () => {
  assert.equal(findNextUnsolvedSentenceIndex(items, ['a', 'c'], 0), 1);
  assert.equal(findNextUnsolvedSentenceIndex(items, ['a', 'c'], 1), 3);
});

testCase('next sentence wraps around to the next remaining unsolved question', () => {
  assert.equal(findNextUnsolvedSentenceIndex(items, ['a', 'b', 'c'], 3), 3);
});

testCase('next sentence returns null when all questions are solved', () => {
  assert.equal(findNextUnsolvedSentenceIndex(items, ['a', 'b', 'c', 'd'], 1), null);
  assert.equal(findNextUnsolvedSentenceIndex([], [], 0), null);
});
