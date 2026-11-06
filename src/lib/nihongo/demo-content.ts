export type GrammarItem = {
  id: string;
  title: string;
  pattern: string;
  explanation: string;
  formation: string;
  examples: { japanese: string; romaji: string; meaning: string }[];
  category: string;
  difficulty: 'Beginner' | 'Core' | 'Challenge';
};

export type VocabularyItem = {
  id: string;
  word: string;
  kana: string;
  romaji: string;
  meaning: string;
  partOfSpeech: string;
  example: string;
  exampleRomaji: string;
  exampleMeaning: string;
};

export type KanjiItem = {
  id: string;
  character: string;
  meaning: string;
  onYomi: string[];
  kunYomi: string[];
  strokes: number;
  radical: string;
  example: string;
  exampleMeaning: string;
};

export type PracticeQuestion = {
  id: string;
  type: 'choice' | 'fill';
  prompt: string;
  romaji: string;
  meaning: string;
  options?: string[];
  answer: string;
  explanation: string;
  rule: string;
};

export const grammar: GrammarItem[] = [
  {
    id: 'wa-topic', title: 'Marking the topic with は', pattern: 'Noun + は + description',
    explanation: 'は marks the topic of a sentence — the person or thing you are talking about. It is written は but pronounced “wa” when used as a topic marker.',
    formation: 'わたし + は + がくせい + です', category: 'Particles', difficulty: 'Beginner',
    examples: [{ japanese: 'わたしは学生です。', romaji: 'Watashi wa gakusei desu.', meaning: 'I am a student.' }, { japanese: 'これは本です。', romaji: 'Kore wa hon desu.', meaning: 'This is a book.' }]
  },
  {
    id: 'no-possession', title: 'Showing possession with の', pattern: 'Noun 1 + の + Noun 2',
    explanation: 'の connects two nouns. It often shows possession, relationship, or what something is associated with.',
    formation: 'わたし + の + 本', category: 'Particles', difficulty: 'Beginner',
    examples: [{ japanese: 'これはわたしの本です。', romaji: 'Kore wa watashi no hon desu.', meaning: 'This is my book.' }]
  },
  {
    id: 'wo-object', title: 'Marking the object with を', pattern: 'Subject は + Object を + Verb',
    explanation: 'を marks the direct object of an action. It is written を and pronounced “o” in modern Japanese.',
    formation: '本 + を + 読みます', category: 'Particles', difficulty: 'Core',
    examples: [{ japanese: '本を読みます。', romaji: 'Hon o yomimasu.', meaning: 'I read a book.' }]
  },
  {
    id: 'ni-time', title: 'Time and destination with に', pattern: 'Time / Destination + に',
    explanation: 'に can mark a specific time or the destination of movement. The exact meaning depends on the verb and sentence.',
    formation: '七時 + に + おきます', category: 'Particles', difficulty: 'Core',
    examples: [{ japanese: '七時におきます。', romaji: 'Shichi-ji ni okimasu.', meaning: 'I wake up at seven.' }]
  },
  {
    id: 'de-place', title: 'Where an action happens: で', pattern: 'Place + で + Action',
    explanation: 'で marks the place where an action takes place. Compare it with に, which can mark existence or a destination.',
    formation: '学校 + で + 勉強します', category: 'Particles', difficulty: 'Core',
    examples: [{ japanese: '学校で日本語を勉強します。', romaji: 'Gakkou de nihongo o benkyou shimasu.', meaning: 'I study Japanese at school.' }]
  },
  {
    id: 'masu-verbs', title: 'Polite present and future verbs', pattern: 'Verb stem + ます',
    explanation: 'ます creates a polite non-past verb form. It can describe a habit or an action that will happen in the future.',
    formation: '食べ + ます', category: 'Verbs', difficulty: 'Challenge',
    examples: [{ japanese: '毎朝パンを食べます。', romaji: 'Maiasa pan o tabemasu.', meaning: 'I eat bread every morning.' }]
  },
];

export const vocabulary: VocabularyItem[] = [
  { id: 'v1', word: '学校', kana: 'がっこう', romaji: 'gakkou', meaning: 'school', partOfSpeech: 'Noun', example: '学校へ行きます。', exampleRomaji: 'Gakkou e ikimasu.', exampleMeaning: 'I go to school.' },
  { id: 'v2', word: '先生', kana: 'せんせい', romaji: 'sensei', meaning: 'teacher', partOfSpeech: 'Noun', example: '先生はやさしいです。', exampleRomaji: 'Sensei wa yasashii desu.', exampleMeaning: 'The teacher is kind.' },
  { id: 'v3', word: '友達', kana: 'ともだち', romaji: 'tomodachi', meaning: 'friend', partOfSpeech: 'Noun', example: '友達と話します。', exampleRomaji: 'Tomodachi to hanashimasu.', exampleMeaning: 'I talk with a friend.' },
  { id: 'v4', word: '水', kana: 'みず', romaji: 'mizu', meaning: 'water', partOfSpeech: 'Noun', example: '水を飲みます。', exampleRomaji: 'Mizu o nomimasu.', exampleMeaning: 'I drink water.' },
  { id: 'v5', word: '食べる', kana: 'たべる', romaji: 'taberu', meaning: 'to eat', partOfSpeech: 'Verb', example: 'りんごを食べます。', exampleRomaji: 'Ringo o tabemasu.', exampleMeaning: 'I eat an apple.' },
  { id: 'v6', word: '今日', kana: 'きょう', romaji: 'kyou', meaning: 'today', partOfSpeech: 'Time noun', example: '今日は休みです。', exampleRomaji: 'Kyou wa yasumi desu.', exampleMeaning: 'Today is a day off.' },
  { id: 'v7', word: '大きい', kana: 'おおきい', romaji: 'ookii', meaning: 'big; large', partOfSpeech: 'い-adjective', example: '大きい犬です。', exampleRomaji: 'Ookii inu desu.', exampleMeaning: 'It is a big dog.' },
  { id: 'v8', word: '行く', kana: 'いく', romaji: 'iku', meaning: 'to go', partOfSpeech: 'Verb', example: 'あした東京へ行きます。', exampleRomaji: 'Ashita Toukyou e ikimasu.', exampleMeaning: 'I am going to Tokyo tomorrow.' },
];

export const kanji: KanjiItem[] = [
  { id: 'k1', character: '日', meaning: 'sun; day', onYomi: ['ニチ', 'ジツ'], kunYomi: ['ひ', 'か'], strokes: 4, radical: '日', example: '日本（にほん）', exampleMeaning: 'Japan' },
  { id: 'k2', character: '月', meaning: 'moon; month', onYomi: ['ゲツ', 'ガツ'], kunYomi: ['つき'], strokes: 4, radical: '月', example: '月曜日（げつようび）', exampleMeaning: 'Monday' },
  { id: 'k3', character: '人', meaning: 'person', onYomi: ['ジン', 'ニン'], kunYomi: ['ひと'], strokes: 2, radical: '人', example: '日本人（にほんじん）', exampleMeaning: 'Japanese person' },
  { id: 'k4', character: '大', meaning: 'big; large', onYomi: ['ダイ', 'タイ'], kunYomi: ['おお'], strokes: 3, radical: '大', example: '大学（だいがく）', exampleMeaning: 'university' },
  { id: 'k5', character: '小', meaning: 'small', onYomi: ['ショウ'], kunYomi: ['ちい', 'こ', 'お'], strokes: 3, radical: '小', example: '小さい（ちいさい）', exampleMeaning: 'small' },
  { id: 'k6', character: '山', meaning: 'mountain', onYomi: ['サン'], kunYomi: ['やま'], strokes: 3, radical: '山', example: '富士山（ふじさん）', exampleMeaning: 'Mount Fuji' },
  { id: 'k7', character: '川', meaning: 'river', onYomi: ['セン'], kunYomi: ['かわ'], strokes: 3, radical: '川', example: '川（かわ）', exampleMeaning: 'river' },
  { id: 'k8', character: '水', meaning: 'water', onYomi: ['スイ'], kunYomi: ['みず'], strokes: 4, radical: '水', example: '水曜日（すいようび）', exampleMeaning: 'Wednesday' },
];

export const practiceQuestions: PracticeQuestion[] = [
  { id: 'q1', type: 'choice', prompt: 'わたし ___ 学生です。', romaji: 'Watashi ___ gakusei desu.', meaning: 'I am a student.', options: ['は', 'を', 'に', 'で'], answer: 'は', explanation: 'は marks the topic of the sentence. The sentence is talking about “わたし” (I), so は is the correct particle.', rule: 'Topic marker: は' },
  { id: 'q2', type: 'choice', prompt: '毎朝、コーヒー ___ 飲みます。', romaji: 'Maiasa, koohii ___ nomimasu.', meaning: 'I drink coffee every morning.', options: ['が', 'を', 'に', 'へ'], answer: 'を', explanation: 'を marks the direct object of the verb 飲みます (to drink). Coffee is the thing being drunk.', rule: 'Direct object: を' },
  { id: 'q3', type: 'fill', prompt: '七時 ___ おきます。', romaji: 'Shichi-ji ___ okimasu.', meaning: 'I wake up at seven.', options: ['に'], answer: 'に', explanation: 'に marks a specific point in time. Use it after an exact clock time such as 七時.', rule: 'Specific time: に' },
  { id: 'q4', type: 'choice', prompt: '図書館 ___ 本を読みます。', romaji: 'Toshokan ___ hon o yomimasu.', meaning: 'I read a book at the library.', options: ['で', 'に', 'の', 'を'], answer: 'で', explanation: 'で marks the place where an action happens. Reading is an action taking place at the library.', rule: 'Action location: で' },
];

export const kanaRows = [
  ['あ','い','う','え','お'], ['か','き','く','け','こ'], ['さ','し','す','せ','そ'],
  ['た','ち','つ','て','と'], ['な','に','ぬ','ね','の'], ['は','ひ','ふ','へ','ほ'],
  ['ま','み','む','め','も'], ['や','','ゆ','','よ'], ['ら','り','る','れ','ろ'], ['わ','','','','を'], ['ん','','','','']
];
export const katakanaRows = [
  ['ア','イ','ウ','エ','オ'], ['カ','キ','ク','ケ','コ'], ['サ','シ','ス','セ','ソ'],
  ['タ','チ','ツ','テ','ト'], ['ナ','ニ','ヌ','ネ','ノ'], ['ハ','ヒ','フ','ヘ','ホ'],
  ['マ','ミ','ム','メ','モ'], ['ヤ','','ユ','','ヨ'], ['ラ','リ','ル','レ','ロ'], ['ワ','','','','ヲ'], ['ン','','','','']
];
export const kanaRomajiRows = [
  ['a','i','u','e','o'], ['ka','ki','ku','ke','ko'], ['sa','shi','su','se','so'],
  ['ta','chi','tsu','te','to'], ['na','ni','nu','ne','no'], ['ha','hi','fu','he','ho'],
  ['ma','mi','mu','me','mo'], ['ya','','yu','','yo'], ['ra','ri','ru','re','ro'], ['wa','','','','wo'], ['n','','','','']
];

// Voiced (dakuten) and semi-voiced (handakuten) kana, shown beneath the basic chart.
export const hiraganaVoicedRows = [
  ['が','ぎ','ぐ','げ','ご'], ['ざ','じ','ず','ぜ','ぞ'], ['だ','ぢ','づ','で','ど'],
  ['ば','び','ぶ','べ','ぼ'], ['ぱ','ぴ','ぷ','ぺ','ぽ']
];
export const hiraganaVoicedRomajiRows = [
  ['ga','gi','gu','ge','go'], ['za','ji','zu','ze','zo'], ['da','ji','zu','de','do'],
  ['ba','bi','bu','be','bo'], ['pa','pi','pu','pe','po']
];
export const katakanaVoicedRows = [
  ['ガ','ギ','グ','ゲ','ゴ'], ['ザ','ジ','ズ','ゼ','ゾ'], ['ダ','ヂ','ヅ','デ','ド'],
  ['バ','ビ','ブ','ベ','ボ'], ['パ','ピ','プ','ペ','ポ']
];
export const katakanaVoicedRomajiRows = [
  ['ga','gi','gu','ge','go'], ['za','ji','zu','ze','zo'], ['da','ji','zu','de','do'],
  ['ba','bi','bu','be','bo'], ['pa','pi','pu','pe','po']
];

export const readingPassage = {
  title: 'A Sunday in the city',
  japanese: '日曜日に、わたしは友達と公園へ行きました。公園でたくさん写真を撮りました。それから、小さい店でお茶を飲みました。とても楽しい日でした。',
  romaji: 'Nichiyoubi ni, watashi wa tomodachi to kouen e ikimashita. Kouen de takusan shashin o torimashita. Sorekara, chiisai mise de ocha o nomimashita. Totemo tanoshii hi deshita.',
  translation: 'On Sunday, I went to the park with a friend. We took many photos in the park. After that, we drank tea at a small shop. It was a very enjoyable day.',
  question: 'Where did the speaker drink tea?', options: ['At the park', 'At a small shop', 'At school', 'At home'], answer: 'At a small shop', explanation: 'The passage says 小さい店でお茶を飲みました — “I drank tea at a small shop.”'
};
