import assert from 'node:assert/strict';
import testCase from 'node:test';
import { getSentenceConstructionItems, sentenceConstructionBank } from '../src/lib/nihongo/sentence-construction-bank';

testCase('sentence construction bank contains at least 150 exercises', () => {
  assert.ok(sentenceConstructionBank.length >= 150);
  assert.equal(getSentenceConstructionItems('N5').length, 80);
  assert.equal(getSentenceConstructionItems('N4').length, 80);
});

testCase('every sentence has unique id, tokens, meaning and grammar tags', () => {
  const ids = new Set<string>();
  for (const item of sentenceConstructionBank) {
    assert.ok(!ids.has(item.id), `duplicate sentence id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.tokens.length >= 3, `${item.id} needs at least three construction tiles`);
    assert.ok(item.tokens.every((token) => token.trim().length > 0), `${item.id} contains an empty tile`);
    assert.equal(item.tokens.join(''), item.sentence, `${item.id} tokens do not reconstruct the sentence`);
    assert.ok(item.meaning.length > 0, `${item.id} is missing its translation`);
    assert.ok(item.romaji.length > 0, `${item.id} is missing romaji`);
    assert.ok(item.grammarTags.length > 0, `${item.id} is missing grammar tags`);
  }
});
