import assert from 'node:assert/strict';
import testCase from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  estimateReadingMinutes,
  getPassageText,
  getPassagesForLevel,
  getReadingPassageById,
  kanaToRomaji,
  getSelectedRomajiForTextRange,
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


    assert.match(getPassageText(passage), /[\u4e00-\u9fff]/u);
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


testCase('selection popup maps only text offsets selected inside each reading token', () => {
  const component = readFileSync(resolve(process.cwd(), 'src/components/nihongo/reading-studio.tsx'), 'utf8');
  assert.match(component, /document\.addEventListener\('mouseup', updatePopupAfterSelection\)/);
  assert.match(component, /window\.requestAnimationFrame/);
  assert.match(component, /createPortal\(/);
  assert.match(component, /getSelectedOffsetsForToken\(range, node\)/);
  assert.match(component, /getSelectedRomajiForTextRange\(/);
  assert.match(component, /compareBoundaryPoints\(Range\.END_TO_START, tokenRange\) < 0/);
  assert.match(component, /compareBoundaryPoints\(Range\.START_TO_END, tokenRange\) > 0/);
  assert.match(component, /if \(!startsInsideReader \|\| !endsInsideReader\)/);
  assert.doesNotMatch(component, /rangeOverlapsNodeContents/);
});


testCase('every graded reader is long enough for at least six minutes', () => {
  const tooShort = readingPassages
    .map((passage) => ({
      id: passage.id,
      level: passage.level,
      characters: Array.from(getPassageText(passage)).length,
      minutes: estimateReadingMinutes(passage),
    }))
    .filter((passage) => passage.characters <= 350 || passage.minutes < 6);
  assert.deepEqual(tooShort, []);
});

testCase('kana romanisation reads sentence particles correctly', () => {
  assert.equal(kanaToRomaji('きょうは'), 'kyō wa');
  assert.equal(kanaToRomaji('がっこうへ'), 'gakkō e');
  assert.equal(kanaToRomaji('ほんを'), 'hon o');
});


testCase('reading card is exempt from global selection and copy protection', () => {
  const component = readFileSync(resolve(process.cwd(), 'src/components/nihongo/reading-studio.tsx'), 'utf8');
  const globals = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
  const protection = readFileSync(resolve(process.cwd(), 'src/components/copy-protection.tsx'), 'utf8');
  assert.match(component, /data-allow-copy="true"/);
  assert.match(globals, /\[data-allow-copy="true"\] \*/);
  assert.match(protection, /selectionIsInsideAllowedContent/);
  assert.match(protection, /startRoot === endRoot/);
});

testCase('reading studio has one global romaji control and an explicit meaning panel toggle', () => {
  const component = readFileSync(resolve(process.cwd(), 'src/components/nihongo/reading-studio.tsx'), 'utf8');
  assert.match(component, /romajiToggle[\s\S]*Show romaji/);
  assert.doesNotMatch(component, /showFullRomaji|Show full romaji|Hide full romaji/);
  assert.match(component, /aria-controls=.*reading-meaning/);
  assert.match(component, /hidden=\{!showMeaning\}/);
  assert.match(component, /passageMeaning\.map/);
});


testCase('partial reading selections return only the selected romaji characters', () => {
  assert.equal(getSelectedRomajiForTextRange('雨が降る日は', 'あめがふるひは', undefined, 0, 2), 'amega');
  assert.equal(getSelectedRomajiForTextRange('来ますから', 'きますから', undefined, 2, 5), 'sukara');
  assert.equal(getSelectedRomajiForTextRange('ホームで待ちます。', 'ほーむでまちます', undefined, 0, 1), 'ho');
  assert.equal(getSelectedRomajiForTextRange('は', 'は', 'wa', 0, 1), 'wa');
});

testCase('partial kanji selections are limited to their aligned reading segment', () => {
  assert.equal(getSelectedRomajiForTextRange('電車', 'でんしゃ', undefined, 0, 1), 'den');
  assert.equal(getSelectedRomajiForTextRange('電車', 'でんしゃ', undefined, 1, 2), 'sha');
});

testCase('reading popup derives romaji from selected token offsets instead of whole-token readings', () => {
  const component = readFileSync(resolve(process.cwd(), 'src/components/nihongo/reading-studio.tsx'), 'utf8');
  assert.match(component, /getSelectedOffsetsForToken\(range, node\)/);
  assert.match(component, /getSelectedRomajiForTextRange\(/);
  assert.match(component, /\.join\(' '\)/);
  assert.match(component, /data-reading=\{token\.reading/);
  assert.doesNotMatch(component, /\.map\(\(node\) => node\.dataset\.romaji/);
});
