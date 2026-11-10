import assert from 'node:assert/strict';
import testCase from 'node:test';
import {
  estimateReadingMinutes,
  getPassageText,
  getPassagesForLevel,
  getReadingPassageById,
  kanaToRomaji,
  readingPassages,
} from '../src/lib/nihongo/reading-content';

testCase('reading library contains a substantial N5 and N4 collection', () => {
  assert.equal(getPassagesForLevel('N5').length, 12);
  assert.equal(getPassagesForLevel('N4').length, 14);
  assert.equal(readingPassages.length, 26);
});

testCase('every reading has a unique id, context, kanji-rich passage and translations', () => {
  const ids = readingPassages.map((passage) => passage.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const passage of readingPassages) {
    assert.ok(passage.context.length > 0);
    assert.ok(passage.title.length > 0);
    assert.ok(passage.paragraphs.length >= 2);
    assert.ok(getPassageText(passage).length > 80);
    assert.ok(passage.paragraphs.flat().every((sentence) => sentence.meaning.length > 0));
    assert.ok(passage.vocabulary.length >= 3);
  }
});

testCase('passages can be resolved by stable id and level', () => {
  assert.equal(getReadingPassageById('n5-morning-routine', 'N5')?.title, 'A calm morning');
  assert.equal(getReadingPassageById('n5-morning-routine', 'N4'), undefined);
  assert.equal(getReadingPassageById('not-a-real-passage', 'N5'), undefined);
});

testCase('kana romanisation handles small tsu, n and long vowels', () => {
  assert.equal(kanaToRomaji('がっこう'), 'gakkō');
  assert.equal(kanaToRomaji('しんぶん'), 'shinbun');
  assert.equal(kanaToRomaji('きょう'), 'kyō');
  assert.equal(kanaToRomaji('コンピューター'), 'konpyūtā');
});

testCase('reading time is calculated and always at least one minute', () => {
  for (const passage of readingPassages) {
    assert.ok(estimateReadingMinutes(passage) >= 1);
  }
});
