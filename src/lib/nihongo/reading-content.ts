export type ReadingLevel = 'N5' | 'N4';

export type ReadingToken = {
  text: string;
  reading: string;
  romaji?: string;
};

export type ReadingSentence = {
  tokens: ReadingToken[];
  meaning: string;
};

export type ReadingPassage = {
  id: string;
  level: ReadingLevel;
  context: string;
  title: string;
  summary: string;
  paragraphs: ReadingSentence[][];
  vocabulary: Array<{ word: string; reading: string; meaning: string }>;
};

const t = (text: string, reading = '', romaji?: string): ReadingToken => ({ text, reading, romaji });
const s = (meaning: string, ...tokens: ReadingToken[]): ReadingSentence => ({ meaning, tokens });

export const readingPassages: ReadingPassage[] = [
  {
    id: 'n5-morning-routine', level: 'N5', context: 'Daily life', title: 'A calm morning',
    summary: 'Follow a student through a familiar weekday morning.',
    paragraphs: [
      [
        s('I get up at six every morning.', t('私','わたし'), t('は','は','wa'), t('毎朝','まいあさ'), t('六時','ろくじ'), t('に','に'), t('起きます。','おきます')),
        s('I wash my face and eat breakfast in the kitchen.', t('顔','かお'), t('を','を','o'), t('洗って','あらって'), t('、'), t('台所','だいどころ'), t('で','で'), t('朝ご飯','あさごはん'), t('を','を','o'), t('食べます。','たべます')),
      ],
      [
        s('At seven, I leave home and walk to the station.', t('七時','しちじ'), t('に','に'), t('家','いえ'), t('を','を','o'), t('出て','でて'), t('、'), t('駅','えき'), t('まで','まで'), t('歩きます。','あるきます')),
        s('I study Japanese at school from eight.', t('八時','はちじ'), t('から','から'), t('学校','がっこう'), t('で','で'), t('日本語','にほんご'), t('を','を','o'), t('勉強します。','べんきょうします')),
      ],
    ],
    vocabulary: [
      { word: '毎朝', reading: 'まいあさ', meaning: 'every morning' },
      { word: '台所', reading: 'だいどころ', meaning: 'kitchen' },
      { word: '出る', reading: 'でる', meaning: 'to leave; to go out' },
    ],
  },
  {
    id: 'n5-convenience-store', level: 'N5', context: 'Shopping & food', title: 'At the convenience store',
    summary: 'Buy a quick snack on the way home from school.',
    paragraphs: [
      [
        s('After school, I go to the shop near the station.', t('学校','がっこう'), t('の','の'), t('帰り','かえり'), t('に','に'), t('、'), t('駅','えき'), t('の','の'), t('近く','ちかく'), t('の','の'), t('店','みせ'), t('へ','へ','e'), t('行きます。','いきます')),
        s('I buy a rice ball and a bottle of milk.', t('おにぎり','おにぎり'), t('と','と'), t('牛乳','ぎゅうにゅう'), t('を','を','o'), t('一本','いっぽん'), t('買います。','かいます')),
      ],
      [
        s('The rice ball is three hundred yen.', t('おにぎり','おにぎり'), t('は','は','wa'), t('三百円','さんびゃくえん'), t('です。','です')),
        s('The staff member smiles and says thank you.', t('店員','てんいん'), t('さん','さん'), t('は','は','wa'), t('笑って','わらって'), t('、'), t('ありがとう','ありがとう'), t('と','と'), t('言いました。','いいました')),
      ],
    ],
    vocabulary: [
      { word: '帰り', reading: 'かえり', meaning: 'the way back; on the way home' },
      { word: '近く', reading: 'ちかく', meaning: 'nearby' },
      { word: '店員', reading: 'てんいん', meaning: 'shop assistant' },
    ],
  },
  {
    id: 'n5-school-library', level: 'N5', context: 'School & study', title: 'An afternoon in the library',
    summary: 'A student borrows a book and studies quietly.',
    paragraphs: [
      [
        s('The library is behind the school.', t('図書館','としょかん'), t('は','は','wa'), t('学校','がっこう'), t('の','の'), t('後ろ','うしろ'), t('に','に'), t('あります。','あります')),
        s('There are many books and a few computers.', t('本','ほん'), t('が','が'), t('たくさん','たくさん'), t('あります。','あります'), t('コンピューター','コンピューター'), t('も','も'), t('少し','すこし'), t('あります。','あります')),
      ],
      [
        s('I read a Japanese book for one hour.', t('私','わたし'), t('は','は','wa'), t('一時間','いちじかん'), t('、'), t('日本語','にほんご'), t('の','の'), t('本','ほん'), t('を','を','o'), t('読みます。','よみます')),
        s('Before going home, I return the book to the desk.', t('家','いえ'), t('へ','へ','e'), t('帰る','かえる'), t('前','まえ'), t('に','に'), t('、'), t('本','ほん'), t('を','を','o'), t('カウンター','カウンター'), t('に','に'), t('返します。','かえします')),
      ],
    ],
    vocabulary: [
      { word: '図書館', reading: 'としょかん', meaning: 'library' },
      { word: '後ろ', reading: 'うしろ', meaning: 'behind' },
      { word: '返す', reading: 'かえす', meaning: 'to return something' },
    ],
  },
  {
    id: 'n5-train-ride', level: 'N5', context: 'Travel & transport', title: 'The morning train',
    summary: 'Read a short trip across town by train.',
    paragraphs: [
      [
        s('I take the seven-thirty train every day.', t('私','わたし'), t('は','は','wa'), t('毎日','まいにち'), t('七時半','しちじはん'), t('の','の'), t('電車','でんしゃ'), t('に','に'), t('乗ります。','のります')),
        s('The train is crowded, so I stand near the door.', t('電車','でんしゃ'), t('は','は','wa'), t('人','ひと'), t('が','が'), t('多い','おおい'), t('です','です'), t('から','から'), t('、'), t('ドア','ドア'), t('の','の'), t('近く','ちかく'), t('に','に'), t('立ちます。','たちます')),
      ],
      [
        s('I listen to music and look outside.', t('音楽','おんがく'), t('を','を','o'), t('聞いて','きいて'), t('、'), t('外','そと'), t('を','を','o'), t('見ます。','みます')),
        s('I get off at the next station.', t('次','つぎ'), t('の','の'), t('駅','えき'), t('で','で'), t('電車','でんしゃ'), t('を','を','o'), t('降ります。','おります')),
      ],
    ],
    vocabulary: [
      { word: '電車', reading: 'でんしゃ', meaning: 'train' },
      { word: '乗る', reading: 'のる', meaning: 'to ride; to board' },
      { word: '降りる', reading: 'おりる', meaning: 'to get off' },
    ],
  },
  {
    id: 'n5-park-weekend', level: 'N5', context: 'Nature & leisure', title: 'A Sunday at the park',
    summary: 'Enjoy a sunny afternoon with a friend.',
    paragraphs: [
      [
        s('On Sunday, the weather is sunny and warm.', t('日曜日','にちようび'), t('は','は','wa'), t('天気','てんき'), t('が','が'), t('よくて','よくて'), t('、'), t('暖かい','あたたかい'), t('です。','です')),
        s('My friend and I go to a big park.', t('友達','ともだち'), t('と','と'), t('私','わたし'), t('は','は','wa'), t('大きい','おおきい'), t('公園','こうえん'), t('へ','へ','e'), t('行きます。','いきます')),
      ],
      [
        s('Children play, and people walk their dogs.', t('子ども','こども'), t('たち','たち'), t('は','は','wa'), t('遊んで','あそんで'), t('います。','います'), t('人','ひと'), t('は','は','wa'), t('犬','いぬ'), t('と','と'), t('歩いて','あるいて'), t('います。','います')),
        s('We sit under a tree and eat sandwiches.', t('私たち','わたしたち'), t('は','は','wa'), t('木','き'), t('の','の'), t('下','した'), t('に','に'), t('座って','すわって'), t('、'), t('サンドイッチ','サンドイッチ'), t('を','を','o'), t('食べます。','たべます')),
      ],
    ],
    vocabulary: [
      { word: '公園', reading: 'こうえん', meaning: 'park' },
      { word: '暖かい', reading: 'あたたかい', meaning: 'warm' },
      { word: '座る', reading: 'すわる', meaning: 'to sit' },
    ],
  },
  {
    id: 'n5-family-dinner', level: 'N5', context: 'Family & home', title: 'Dinner with my family',
    summary: 'A family prepares and shares an evening meal.',
    paragraphs: [
      [
        s('My mother cooks fish and vegetables.', t('母','はは'), t('は','は','wa'), t('魚','さかな'), t('と','と'), t('野菜','やさい'), t('を','を','o'), t('料理します。','りょうりします')),
        s('My father puts the plates on the table.', t('父','ちち'), t('は','は','wa'), t('皿','さら'), t('を','を','o'), t('テーブル','テーブル'), t('の','の'), t('上','うえ'), t('に','に'), t('置きます。','おきます')),
      ],
      [
        s('We eat dinner together at seven.', t('私たち','わたしたち'), t('は','は','wa'), t('七時','しちじ'), t('に','に'), t('一緒','いっしょ'), t('に','に'), t('晩ご飯','ばんごはん'), t('を','を','o'), t('食べます。','たべます')),
        s('After dinner, I wash the dishes.', t('晩ご飯','ばんごはん'), t('の','の'), t('後','あと'), t('で','で'), t('、'), t('私','わたし'), t('は','は','wa'), t('皿','さら'), t('を','を','o'), t('洗います。','あらいます')),
      ],
    ],
    vocabulary: [
      { word: '野菜', reading: 'やさい', meaning: 'vegetables' },
      { word: '一緒に', reading: 'いっしょに', meaning: 'together' },
      { word: '晩ご飯', reading: 'ばんごはん', meaning: 'dinner' },
    ],
  },
  {
    id: 'n5-weather-rain', level: 'N5', context: 'Weather & seasons', title: 'A rainy afternoon',
    summary: 'A change in the weather changes the day’s plans.',
    paragraphs: [
      [
        s('It is sunny in the morning, but clouds appear at noon.', t('朝','あさ'), t('は','は','wa'), t('晴れ','はれ'), t('でした','でした'), t('が','が'), t('、'), t('昼','ひる'), t('に','に'), t('雲','くも'), t('が','が'), t('出ました。','でました')),
        s('Soon, it starts raining.', t('すぐ','すぐ'), t('に','に'), t('雨','あめ'), t('が','が'), t('降り始めました。','ふりはじめました')),
      ],
      [
        s('I open my umbrella and go to the bus stop.', t('傘','かさ'), t('を','を','o'), t('開いて','ひらいて'), t('、'), t('バス停','バスてい'), t('へ','へ','e'), t('行きます。','いきます')),
        s('The air is cool, and the street smells fresh.', t('空気','くうき'), t('は','は','wa'), t('涼しくて','すずしくて'), t('、'), t('道','みち'), t('は','は','wa'), t('いい','いい'), t('におい','におい'), t('が','が'), t('します。','します')),
      ],
    ],
    vocabulary: [
      { word: '雲', reading: 'くも', meaning: 'cloud' },
      { word: '傘', reading: 'かさ', meaning: 'umbrella' },
      { word: '涼しい', reading: 'すずしい', meaning: 'cool (weather)' },
    ],
  },
  {
    id: 'n5-clothes-shopping', level: 'N5', context: 'Shopping & food', title: 'Buying a new jacket',
    summary: 'Compare sizes and prices at a clothes shop.',
    paragraphs: [
      [
        s('I need a jacket because winter is coming.', t('冬','ふゆ'), t('が','が'), t('来ます','きます'), t('から','から'), t('、'), t('新しい','あたらしい'), t('上着','うわぎ'), t('が','が'), t('必要','ひつよう'), t('です。','です')),
        s('I go to a clothes shop with my sister.', t('妹','いもうと'), t('と','と'), t('服','ふく'), t('の','の'), t('店','みせ'), t('へ','へ','e'), t('行きます。','いきます')),
      ],
      [
        s('The blue jacket is nice, but it is a little expensive.', t('青い','あおい'), t('上着','うわぎ'), t('は','は','wa'), t('きれい','きれい'), t('ですが','ですが'), t('、'), t('少し','すこし'), t('高い','たかい'), t('です。','です')),
        s('I choose a black jacket that is cheaper.', t('もっと','もっと'), t('安い','やすい'), t('黒い','くろい'), t('上着','うわぎ'), t('を','を','o'), t('選びました。','えらびました')),
      ],
    ],
    vocabulary: [
      { word: '上着', reading: 'うわぎ', meaning: 'jacket; outerwear' },
      { word: '必要', reading: 'ひつよう', meaning: 'necessary' },
      { word: '選ぶ', reading: 'えらぶ', meaning: 'to choose' },
    ],
  },
  {
    id: 'n5-friends-cafe', level: 'N5', context: 'Friends & social life', title: 'Meeting a friend at a café',
    summary: 'Make a plan, meet on time and talk over tea.',
    paragraphs: [
      [
        s('I meet my friend at a café near the station.', t('駅','えき'), t('の','の'), t('近く','ちかく'), t('の','の'), t('カフェ','カフェ'), t('で','で'), t('友達','ともだち'), t('に','に'), t('会います。','あいます')),
        s('My friend arrives at three o’clock.', t('友達','ともだち'), t('は','は','wa'), t('三時','さんじ'), t('に','に'), t('来ました。','きました')),
      ],
      [
        s('I order tea, and my friend orders coffee.', t('私','わたし'), t('は','は','wa'), t('紅茶','こうちゃ'), t('を','を','o'), t('頼んで','たのんで'), t('、'), t('友達','ともだち'), t('は','は','wa'), t('コーヒー','コーヒー'), t('を','を','o'), t('頼みました。','たのみました')),
        s('We talk about music and our weekend plans.', t('音楽','おんがく'), t('と','と'), t('週末','しゅうまつ'), t('の','の'), t('予定','よてい'), t('に','に'), t('ついて','ついて'), t('話しました。','はなしました')),
      ],
    ],
    vocabulary: [
      { word: '会う', reading: 'あう', meaning: 'to meet' },
      { word: '頼む', reading: 'たのむ', meaning: 'to order; to ask' },
      { word: '週末', reading: 'しゅうまつ', meaning: 'weekend' },
    ],
  },
  {
    id: 'n5-post-office', level: 'N5', context: 'Community & services', title: 'Sending a letter',
    summary: 'Visit the post office to send a letter to a friend.',
    paragraphs: [
      [
        s('Today, I write a letter to my friend in Osaka.', t('今日','きょう'), t('、'), t('大阪','おおさか'), t('に','に'), t('いる','いる'), t('友達','ともだち'), t('に','に'), t('手紙','てがみ'), t('を','を','o'), t('書きます。','かきます')),
        s('I put the letter in an envelope.', t('手紙','てがみ'), t('を','を','o'), t('封筒','ふうとう'), t('に','に'), t('入れます。','いれます')),
      ],
      [
        s('The post office is open until five.', t('郵便局','ゆうびんきょく'), t('は','は','wa'), t('五時','ごじ'), t('まで','まで'), t('開いて','あいて'), t('います。','います')),
        s('I buy a stamp and send the letter.', t('切手','きって'), t('を','を','o'), t('買って','かって'), t('、'), t('手紙','てがみ'), t('を','を','o'), t('送りました。','おくりました')),
      ],
    ],
    vocabulary: [
      { word: '手紙', reading: 'てがみ', meaning: 'letter' },
      { word: '郵便局', reading: 'ゆうびんきょく', meaning: 'post office' },
      { word: '切手', reading: 'きって', meaning: 'postage stamp' },
    ],
  },
  {
    id: 'n5-at-the-clinic', level: 'N5', context: 'Health & wellbeing', title: 'A visit to the clinic',
    summary: 'Explain a simple problem and follow the doctor’s advice.',
    paragraphs: [
      [
        s('I have a headache, so I go to the clinic.', t('頭','あたま'), t('が','が'), t('痛い','いたい'), t('です','です'), t('から','から'), t('、'), t('病院','びょういん'), t('へ','へ','e'), t('行きます。','いきます')),
        s('The doctor asks when the pain started.', t('医者','いしゃ'), t('は','は','wa'), t('いつ','いつ'), t('から','から'), t('痛い','いたい'), t('か','か'), t('聞きます。','ききます')),
      ],
      [
        s('I say that it started yesterday.', t('昨日','きのう'), t('から','から'), t('です','です'), t('と','と'), t('言います。','いいます')),
        s('The doctor tells me to rest and drink water.', t('医者','いしゃ'), t('は','は','wa'), t('休んで','やすんで'), t('、'), t('水','みず'), t('を','を','o'), t('飲んで','のんで'), t('ください','ください'), t('と','と'), t('言いました。','いいました')),
      ],
    ],
    vocabulary: [
      { word: '頭', reading: 'あたま', meaning: 'head' },
      { word: '痛い', reading: 'いたい', meaning: 'painful; to hurt' },
      { word: '休む', reading: 'やすむ', meaning: 'to rest; to take a day off' },
    ],
  },
  {
    id: 'n5-photography-hobby', level: 'N5', context: 'Hobbies & interests', title: 'My new hobby',
    summary: 'A learner discovers photography during a day out.',
    paragraphs: [
      [
        s('I like taking photographs on weekends.', t('私','わたし'), t('は','は','wa'), t('週末','しゅうまつ'), t('に','に'), t('写真','しゃしん'), t('を','を','o'), t('撮る','とる'), t('こと','こと'), t('が','が'), t('好き','すき'), t('です。','です')),
        s('I take my camera to the river.', t('カメラ','カメラ'), t('を','を','o'), t('持って','もって'), t('、'), t('川','かわ'), t('へ','へ','e'), t('行きます。','いきます')),
      ],
      [
        s('I photograph flowers, birds and the sky.', t('花','はな'), t('や','や'), t('鳥','とり'), t('や','や'), t('空','そら'), t('の','の'), t('写真','しゃしん'), t('を','を','o'), t('撮ります。','とります')),
        s('When I get home, I show the pictures to my family.', t('家','いえ'), t('に','に'), t('帰って','かえって'), t('から','から'), t('、'), t('家族','かぞく'), t('に','に'), t('写真','しゃしん'), t('を','を','o'), t('見せます。','みせます')),
      ],
    ],
    vocabulary: [
      { word: '写真', reading: 'しゃしん', meaning: 'photograph' },
      { word: '撮る', reading: 'とる', meaning: 'to take a photo' },
      { word: '家族', reading: 'かぞく', meaning: 'family' },
    ],
  },

  {
    id: 'n4-new-apartment', level: 'N4', context: 'Daily life', title: 'Moving into a new apartment',
    summary: 'Prepare a small apartment and learn the neighbourhood.',
    paragraphs: [
      [
        s('Last month, I moved into a small apartment near the station.', t('先月','せんげつ'), t('、'), t('駅','えき'), t('の','の'), t('近く','ちかく'), t('に','に'), t('ある','ある'), t('小さな','ちいさな'), t('アパート','アパート'), t('に','に'), t('引っ越しました。','ひっこしました')),
        s('The room is not large, but it gets plenty of sunlight.', t('部屋','へや'), t('は','は','wa'), t('広く','ひろく'), t('ありません','ありません'), t('が','が'), t('、'), t('日','ひ'), t('が','が'), t('よく','よく'), t('入ります。','はいります')),
      ],
      [
        s('There is a supermarket and a post office nearby.', t('近所','きんじょ'), t('に','に'), t('スーパー','スーパー'), t('と','と'), t('郵便局','ゆうびんきょく'), t('が','が'), t('あります。','あります')),
        s('I want to become familiar with this area little by little.', t('少しずつ','すこしずつ'), t('この','この'), t('町','まち'), t('に','に'), t('慣れて','なれて'), t('いきたい','いきたい'), t('です。','です')),
      ],
    ],
    vocabulary: [
      { word: '引っ越す', reading: 'ひっこす', meaning: 'to move house' },
      { word: '日当たり', reading: 'ひあたり', meaning: 'sunlight; exposure to the sun' },
      { word: '慣れる', reading: 'なれる', meaning: 'to get used to' },
    ],
  },
  {
    id: 'n4-part-time-job', level: 'N4', context: 'Work & responsibilities', title: 'My first part-time job',
    summary: 'Learn the routine and responsibilities of a café job.',
    paragraphs: [
      [
        s('I started working part-time at a café this spring.', t('この','この'), t('春','はる'), t('から','から'), t('、'), t('カフェ','カフェ'), t('で','で'), t('アルバイト','アルバイト'), t('を','を','o'), t('始めました。','はじめました')),
        s('At first, I was nervous because I did not know the work.', t('初め','はじめ'), t('は','は','wa'), t('仕事','しごと'), t('が','が'), t('分からなくて','わからなくて'), t('、'), t('緊張しました。','きんちょうしました')),
      ],
      [
        s('A senior colleague taught me how to use the register.', t('先輩','せんぱい'), t('が','が'), t('レジ','レジ'), t('の','の'), t('使い方','つかいかた'), t('を','を','o'), t('教えて','おしえて'), t('くれました。','くれました')),
        s('Now I can serve customers with a smile.', t('今','いま'), t('は','は','wa'), t('笑顔','えがお'), t('で','で'), t('お客さん','おきゃくさん'), t('に','に'), t('対応できる','たいおうできる'), t('ように','ように'), t('なりました。','なりました')),
      ],
    ],
    vocabulary: [
      { word: '緊張する', reading: 'きんちょうする', meaning: 'to feel nervous' },
      { word: '先輩', reading: 'せんぱい', meaning: 'senior colleague' },
      { word: '対応する', reading: 'たいおうする', meaning: 'to respond; to handle' },
    ],
  },
  {
    id: 'n4-hotel-reservation', level: 'N4', context: 'Travel & transport', title: 'Checking into a hotel',
    summary: 'Use a reservation and ask about local transport.',
    paragraphs: [
      [
        s('I reserved a hotel room online before the trip.', t('旅行','りょこう'), t('の','の'), t('前','まえ'), t('に','に'), t('、'), t('インターネット','インターネット'), t('で','で'), t('ホテル','ホテル'), t('の','の'), t('部屋','へや'), t('を','を','o'), t('予約しました。','よやくしました')),
        s('At reception, I show my name and reservation number.', t('受付','うけつけ'), t('で','で'), t('、'), t('名前','なまえ'), t('と','と'), t('予約番号','よやくばんごう'), t('を','を','o'), t('見せます。','みせます')),
      ],
      [
        s('The staff explains the breakfast time and Wi-Fi password.', t('スタッフ','スタッフ'), t('は','は','wa'), t('朝食','ちょうしょく'), t('の','の'), t('時間','じかん'), t('と','と'), t('Wi-Fi','ワイファイ'), t('の','の'), t('パスワード','パスワード'), t('を','を','o'), t('説明します。','せつめいします')),
        s('I ask how to get to the nearest bus stop.', t('一番','いちばん'), t('近い','ちかい'), t('バス停','バスてい'), t('へ','へ','e'), t('どう','どう'), t('行けば','いけば'), t('いい','いい'), t('か','か'), t('聞きました。','ききました')),
      ],
    ],
    vocabulary: [
      { word: '予約', reading: 'よやく', meaning: 'reservation' },
      { word: '受付', reading: 'うけつけ', meaning: 'reception; front desk' },
      { word: '説明する', reading: 'せつめいする', meaning: 'to explain' },
    ],
  },
  {
    id: 'n4-lost-property', level: 'N4', context: 'Travel & transport', title: 'A forgotten umbrella',
    summary: 'Ask station staff for help after leaving something on a train.',
    paragraphs: [
      [
        s('I noticed that my umbrella was missing after leaving the train.', t('電車','でんしゃ'), t('を','を','o'), t('降りた','おりた'), t('後','あと'), t('で','で'), t('、'), t('傘','かさ'), t('が','が'), t('ない','ない'), t('こと','こと'), t('に','に'), t('気が付きました。','きがつきました')),
        s('I remembered putting it on the seat beside me.', t('隣','となり'), t('の','の'), t('席','せき'), t('に','に'), t('置いた','おいた'), t('こと','こと'), t('を','を','o'), t('思い出しました。','おもいだしました')),
      ],
      [
        s('I went to the station office and described the umbrella.', t('駅','えき'), t('の','の'), t('事務室','じむしつ'), t('へ','へ','e'), t('行って','いって'), t('、'), t('傘','かさ'), t('の','の'), t('特徴','とくちょう'), t('を','を','o'), t('説明しました。','せつめいしました')),
        s('Fortunately, someone had handed it in.', t('幸い','さいわい'), t('、'), t('誰か','だれか'), t('が','が'), t('届けて','とどけて'), t('くれて','くれて'), t('いました。','いました')),
      ],
    ],
    vocabulary: [
      { word: '気が付く', reading: 'きがつく', meaning: 'to notice' },
      { word: '特徴', reading: 'とくちょう', meaning: 'feature; characteristic' },
      { word: '届ける', reading: 'とどける', meaning: 'to hand in; to deliver' },
    ],
  },
  {
    id: 'n4-local-festival', level: 'N4', context: 'Culture & community', title: 'A summer festival',
    summary: 'Experience food stalls, music and a local tradition.',
    paragraphs: [
      [
        s('Every summer, a festival is held at the shrine in my neighbourhood.', t('毎年','まいとし'), t('夏','なつ'), t('に','に'), t('、'), t('近所','きんじょ'), t('の','の'), t('神社','じんじゃ'), t('で','で'), t('祭り','まつり'), t('が','が'), t('行われます。','おこなわれます')),
        s('People wear light cotton clothes and walk through the streets.', t('人々','ひとびと'), t('は','は','wa'), t('浴衣','ゆかた'), t('を','を','o'), t('着て','きて'), t('、'), t('町','まち'), t('を','を','o'), t('歩きます。','あるきます')),
      ],
      [
        s('There are food stalls selling noodles, sweets and grilled food.', t('屋台','やたい'), t('では','では'), t('、'), t('焼きそば','やきそば'), t('や','や'), t('お菓子','おかし'), t('など','など'), t('が','が'), t('売られて','うられて'), t('います。','います')),
        s('At night, we watch the fireworks with our neighbours.', t('夜','よる'), t('に','に'), t('、'), t('近所','きんじょ'), t('の','の'), t('人','ひと'), t('たち','たち'), t('と','と'), t('花火','はなび'), t('を','を','o'), t('見ます。','みます')),
      ],
    ],
    vocabulary: [
      { word: '神社', reading: 'じんじゃ', meaning: 'Shinto shrine' },
      { word: '浴衣', reading: 'ゆかた', meaning: 'summer kimono' },
      { word: '屋台', reading: 'やたい', meaning: 'festival food stall' },
    ],
  },
  {
    id: 'n4-cooking-curry', level: 'N4', context: 'Food & daily skills', title: 'Cooking curry at home',
    summary: 'Follow a simple recipe and share the result.',
    paragraphs: [
      [
        s('On Saturday, my brother and I decided to make curry.', t('土曜日','どようび'), t('に','に'), t('、'), t('兄','あに'), t('と','と'), t('私','わたし'), t('は','は','wa'), t('カレー','カレー'), t('を','を','o'), t('作る','つくる'), t('こと','こと'), t('に','に'), t('しました。','しました')),
        s('First, we cut the onions, carrots and potatoes.', t('まず','まず'), t('、'), t('玉ねぎ','たまねぎ'), t('と','と'), t('にんじん','にんじん'), t('と','と'), t('じゃがいも','じゃがいも'), t('を','を','o'), t('切ります。','きります')),
      ],
      [
        s('Then we cook the vegetables and meat in a large pot.', t('それから','それから'), t('、'), t('大きな','おおきな'), t('鍋','なべ'), t('で','で'), t('野菜','やさい'), t('と','と'), t('肉','にく'), t('を','を','o'), t('煮ます。','にます')),
        s('We add the curry sauce and wait until it becomes thick.', t('カレー','カレー'), t('の','の'), t('ルー','ルー'), t('を','を','o'), t('入れて','いれて'), t('、'), t('とろみ','とろみ'), t('が','が'), t('出る','でる'), t('まで','まで'), t('待ちます。','まちます')),
      ],
    ],
    vocabulary: [
      { word: '玉ねぎ', reading: 'たまねぎ', meaning: 'onion' },
      { word: '鍋', reading: 'なべ', meaning: 'pot' },
      { word: '煮る', reading: 'にる', meaning: 'to simmer; to boil' },
    ],
  },
  {
    id: 'n4-school-project', level: 'N4', context: 'School & study', title: 'Working on a class project',
    summary: 'Plan a presentation and divide tasks among classmates.',
    paragraphs: [
      [
        s('Our class has to prepare a presentation about Japanese culture.', t('私たち','わたしたち'), t('の','の'), t('クラス','クラス'), t('は','は','wa'), t('、'), t('日本','にほん'), t('の','の'), t('文化','ぶんか'), t('について','について'), t('発表','はっぴょう'), t('を','を','o'), t('準備します。','じゅんびします')),
        s('We form groups of four and decide on a theme.', t('四人','よにん'), t('ずつ','ずつ'), t('グループ','グループ'), t('を','を','o'), t('作って','つくって'), t('、'), t('テーマ','テーマ'), t('を','を','o'), t('決めます。','きめます')),
      ],
      [
        s('I am responsible for finding photographs and information.', t('私','わたし'), t('は','は','wa'), t('写真','しゃしん'), t('と','と'), t('情報','じょうほう'), t('を','を','o'), t('探す','さがす'), t('担当','たんとう'), t('です。','です')),
        s('We check each other’s work before the presentation day.', t('発表','はっぴょう'), t('の','の'), t('日','ひ'), t('の','の'), t('前','まえ'), t('に','に'), t('、'), t('お互い','おたがい'), t('の','の'), t('資料','しりょう'), t('を','を','o'), t('確認します。','かくにんします')),
      ],
    ],
    vocabulary: [
      { word: '文化', reading: 'ぶんか', meaning: 'culture' },
      { word: '情報', reading: 'じょうほう', meaning: 'information' },
      { word: '確認する', reading: 'かくにんする', meaning: 'to check; to confirm' },
    ],
  },
  {
    id: 'n4-neighbourhood-cleanup', level: 'N4', context: 'Culture & community', title: 'Cleaning the neighbourhood',
    summary: 'Join local residents for a community clean-up.',
    paragraphs: [
      [
        s('On the first Sunday of each month, local residents clean the area.', t('毎月','まいつき'), t('の','の'), t('第一','だいいち'), t('日曜日','にちようび'), t('に','に'), t('、'), t('地域','ちいき'), t('の','の'), t('人','ひと'), t('たち','たち'), t('が','が'), t('町','まち'), t('を','を','o'), t('掃除します。','そうじします')),
        s('I bring gloves and a large rubbish bag.', t('私','わたし'), t('は','は','wa'), t('手袋','てぶくろ'), t('と','と'), t('大きな','おおきな'), t('ごみ袋','ごみぶくろ'), t('を','を','o'), t('持って','もって'), t('行きます。','いきます')),
      ],
      [
        s('We separate plastic bottles, cans and other rubbish.', t('ペットボトル','ペットボトル'), t('や','や'), t('缶','かん'), t('や','や'), t('ほか','ほか'), t('の','の'), t('ごみ','ごみ'), t('を','を','o'), t('分けます。','わけます')),
        s('After the work, everyone drinks tea together.', t('作業','さぎょう'), t('の','の'), t('後','あと'), t('で','で'), t('、'), t('みんな','みんな'), t('で','で'), t('一緒','いっしょ'), t('に','に'), t('お茶','おちゃ'), t('を','を','o'), t('飲みます。','のみます')),
      ],
    ],
    vocabulary: [
      { word: '地域', reading: 'ちいき', meaning: 'region; local community' },
      { word: '手袋', reading: 'てぶくろ', meaning: 'gloves' },
      { word: '分ける', reading: 'わける', meaning: 'to separate; to sort' },
    ],
  },
  {
    id: 'n4-medical-appointment', level: 'N4', context: 'Health & wellbeing', title: 'Making a doctor’s appointment',
    summary: 'Describe symptoms and arrange a suitable appointment.',
    paragraphs: [
      [
        s('My throat has hurt for several days, so I call the clinic.', t('何日','なんにち'), t('も','も'), t('喉','のど'), t('が','が'), t('痛い','いたい'), t('ので','ので'), t('、'), t('クリニック','クリニック'), t('に','に'), t('電話します。','でんわします')),
        s('The receptionist asks whether I have a fever.', t('受付','うけつけ'), t('の','の'), t('人','ひと'), t('は','は','wa'), t('、'), t('熱','ねつ'), t('が','が'), t('ある','ある'), t('か','か'), t('どう','どう'), t('か','か'), t('聞きました。','ききました')),
      ],
      [
        s('I explain that I have a slight fever and a cough.', t('少し','すこし'), t('熱','ねつ'), t('が','が'), t('あって','あって'), t('、'), t('咳','せき'), t('も','も'), t('出ます','でます'), t('と','と'), t('説明しました。','せつめいしました')),
        s('We arrange an appointment for ten tomorrow morning.', t('明日','あした'), t('の','の'), t('午前','ごぜん'), t('十時','じゅうじ'), t('に','に'), t('予約','よやく'), t('を','を','o'), t('取りました。','とりました')),
      ],
    ],
    vocabulary: [
      { word: '喉', reading: 'のど', meaning: 'throat' },
      { word: '咳', reading: 'せき', meaning: 'cough' },
      { word: '午前', reading: 'ごぜん', meaning: 'morning; a.m.' },
    ],
  },
  {
    id: 'n4-invitation-email', level: 'N4', context: 'Friends & communication', title: 'An invitation by email',
    summary: 'Read a friendly invitation and reply politely.',
    paragraphs: [
      [
        s('A friend sent me an email inviting me to a birthday party.', t('友達','ともだち'), t('から','から'), t('、'), t('誕生日','たんじょうび'), t('パーティー','パーティー'), t('に','に'), t('誘う','さそう'), t('メール','メール'), t('が','が'), t('届きました。','とどきました')),
        s('The party will be held at a restaurant near the park.', t('パーティー','パーティー'), t('は','は','wa'), t('公園','こうえん'), t('の','の'), t('近く','ちかく'), t('の','の'), t('レストラン','レストラン'), t('で','で'), t('開かれます。','ひらかれます')),
      ],
      [
        s('I want to go, so I reply that I can attend.', t('行きたい','いきたい'), t('ので','ので'), t('、'), t('参加できる','さんかできる'), t('と','と'), t('返事','へんじ'), t('を','を','o'), t('しました。','しました')),
        s('I also ask whether I should bring anything.', t('何か','なにか'), t('持って','もって'), t('行った','いった'), t('ほう','ほう'), t('が','が'), t('いい','いい'), t('か','か'), t('も','も'), t('聞きました。','ききました')),
      ],
    ],
    vocabulary: [
      { word: '誘う', reading: 'さそう', meaning: 'to invite' },
      { word: '届く', reading: 'とどく', meaning: 'to arrive; to be delivered' },
      { word: '返事', reading: 'へんじ', meaning: 'reply; response' },
    ],
  },
  {
    id: 'n4-train-delay', level: 'N4', context: 'Travel & transport', title: 'A delay on the railway',
    summary: 'Understand an announcement and adjust a travel plan.',
    paragraphs: [
      [
        s('The train stopped because there was an accident ahead.', t('前','まえ'), t('の','の'), t('場所','ばしょ'), t('で','で'), t('事故','じこ'), t('が','が'), t('あった','あった'), t('ため','ため'), t('、'), t('電車','でんしゃ'), t('が','が'), t('止まりました。','とまりました')),
        s('An announcement said that the service would be delayed.', t('車内','しゃない'), t('放送','ほうそう'), t('で','で'), t('、'), t('運転','うんてん'), t('が','が'), t('遅れる','おくれる'), t('と','と'), t('案内','あんない'), t('が','が'), t('ありました。','ありました')),
      ],
      [
        s('I contacted my workplace and explained the situation.', t('職場','しょくば'), t('に','に'), t('連絡して','れんらくして'), t('、'), t('事情','じじょう'), t('を','を','o'), t('説明しました。','せつめいしました')),
        s('I waited for the next train and arrived thirty minutes late.', t('次','つぎ'), t('の','の'), t('電車','でんしゃ'), t('を','を','o'), t('待って','まって'), t('、'), t('三十分','さんじゅっぷん'), t('遅れて','おくれて'), t('着きました。','つきました')),
      ],
    ],
    vocabulary: [
      { word: '事故', reading: 'じこ', meaning: 'accident' },
      { word: '遅れる', reading: 'おくれる', meaning: 'to be delayed; to be late' },
      { word: '事情', reading: 'じじょう', meaning: 'circumstances; situation' },
    ],
  },
  {
    id: 'n4-recycling-rules', level: 'N4', context: 'Home & environment', title: 'Sorting rubbish correctly',
    summary: 'Learn the local collection schedule and recycling rules.',
    paragraphs: [
      [
        s('After moving, I read the rubbish collection guide from the city.', t('引っ越した','ひっこした'), t('後','あと'), t('で','で'), t('、'), t('市','し'), t('から','から'), t('もらった','もらった'), t('ごみ','ごみ'), t('の','の'), t('案内','あんない'), t('を','を','o'), t('読みました。','よみました')),
        s('Burnable rubbish is collected on Monday and Thursday.', t('燃える','もえる'), t('ごみ','ごみ'), t('は','は','wa'), t('月曜日','げつようび'), t('と','と'), t('木曜日','もくようび'), t('に','に'), t('集められます。','あつめられます')),
      ],
      [
        s('Plastic bottles must be washed before they are put out.', t('ペットボトル','ペットボトル'), t('は','は','wa'), t('、'), t('出す','だす'), t('前','まえ'), t('に','に'), t('洗わ','あらわ'), t('なければ','なければ'), t('なりません。','なりません')),
        s('I separate the rubbish at home and follow the rules.', t('家','いえ'), t('で','で'), t('ごみ','ごみ'), t('を','を','o'), t('分けて','わけて'), t('、'), t('ルール','ルール'), t('を','を','o'), t('守ります。','まもります')),
      ],
    ],
    vocabulary: [
      { word: '燃える', reading: 'もえる', meaning: 'to burn; burnable' },
      { word: '集める', reading: 'あつめる', meaning: 'to collect' },
      { word: '守る', reading: 'まもる', meaning: 'to follow; to protect' },
    ],
  },
  {
    id: 'n4-weekend-trip', level: 'N4', context: 'Travel & leisure', title: 'Planning a weekend trip',
    summary: 'Compare transport choices and prepare an itinerary.',
    paragraphs: [
      [
        s('My friends and I are planning a two-day trip.', t('友達','ともだち'), t('と','と'), t('私','わたし'), t('は','は','wa'), t('、'), t('一泊','いっぱく'), t('二日','ふつか'), t('の','の'), t('旅行','りょこう'), t('を','を','o'), t('計画しています。','けいかくしています')),
        s('We compared the cost of travelling by train and by bus.', t('電車','でんしゃ'), t('と','と'), t('バス','バス'), t('の','の'), t('料金','りょうきん'), t('を','を','o'), t('比べました。','くらべました')),
      ],
      [
        s('We chose the train because it takes less time.', t('時間','じかん'), t('が','が'), t('あまり','あまり'), t('かからない','かからない'), t('ので','ので'), t('、'), t('電車','でんしゃ'), t('に','に'), t('決めました。','きめました')),
        s('Next, we will book a hotel and decide where to eat.', t('次','つぎ'), t('に','に'), t('ホテル','ホテル'), t('を','を','o'), t('予約して','よやくして'), t('、'), t('どこ','どこ'), t('で','で'), t('食べる','たべる'), t('か','か'), t('決めます。','きめます')),
      ],
    ],
    vocabulary: [
      { word: '計画する', reading: 'けいかくする', meaning: 'to plan' },
      { word: '料金', reading: 'りょうきん', meaning: 'fee; fare' },
      { word: '比べる', reading: 'くらべる', meaning: 'to compare' },
    ],
  },
  {
    id: 'n4-library-volunteer', level: 'N4', context: 'Community & culture', title: 'Helping at the town library',
    summary: 'Volunteer to organise books and help younger visitors.',
    paragraphs: [
      [
        s('Once a month, I volunteer at the town library.', t('月','つき'), t('に','に'), t('一回','いっかい'), t('、'), t('町','まち'), t('の','の'), t('図書館','としょかん'), t('で','で'), t('ボランティア','ボランティア'), t('を','を','o'), t('しています。','しています')),
        s('I put returned books back on the correct shelves.', t('返された','かえされた'), t('本','ほん'), t('を','を','o'), t('正しい','ただしい'), t('棚','たな'), t('に','に'), t('戻します。','もどします')),
      ],
      [
        s('Sometimes, I read picture books to children.', t('時々','ときどき'), t('、'), t('子ども','こども'), t('たち','たち'), t('に','に'), t('絵本','えほん'), t('を','を','o'), t('読んで','よんで'), t('あげます。','あげます')),
        s('The children listen carefully and ask many questions.', t('子ども','こども'), t('たち','たち'), t('は','は','wa'), t('よく','よく'), t('聞いて','きいて'), t('、'), t('たくさん','たくさん'), t('質問します。','しつもんします')),
      ],
    ],
    vocabulary: [
      { word: '一回', reading: 'いっかい', meaning: 'once; one time' },
      { word: '棚', reading: 'たな', meaning: 'shelf' },
      { word: '質問する', reading: 'しつもんする', meaning: 'to ask a question' },
    ],
  },
];


const line = (meaning: string, ...parts: Array<[string, string]>): ReadingSentence =>
  s(meaning, ...parts.map(([text, reading]) => t(text, reading)));

const passageExpansions: Record<string, ReadingSentence[][]> = {
  'n5-morning-routine': [
    [
      line('Before leaving, I look at the weather and choose my clothes.', ['出かける前に','でかけるまえに'], ['天気を見て','てんきをみて'], ['服を選びます。','ふくをえらびます']),
      line('When it rains, I put an umbrella in my bag.', ['雨が降る日は','あめがふるひは'], ['かばんに','かばんに'], ['傘を入れます。','かさをいれます']),
    ],
    [
      line('At the station, I buy a small bottle of water.', ['駅で','えきで'], ['小さい水を','ちいさいみずを'], ['一本買います。','いっぽんかいます']),
      line('The train comes at seven thirty, so I wait on the platform.', ['電車は七時半に','でんしゃはしちじはんに'], ['来ますから','きますから'], ['ホームで待ちます。','ほーむでまちます']),
    ],
    [
      line('I sit near the window and review yesterday’s words.', ['窓の近くに座って','まどのちかくにすわって'], ['昨日の言葉を','きのうのことばを'], ['復習します。','ふくしゅうします']),
      line('I write new words in a small notebook during the ride.', ['電車の中で','でんしゃのなかで'], ['新しい言葉を','あたらしいことばを'], ['ノートに書きます。','のーとにかきます']),
    ],
    [
      line('After class, I talk with a friend about the homework.', ['授業の後で','じゅぎょうのあとで'], ['友達と','ともだちと'], ['宿題について話します。','しゅくだいについてはなします']),
      line('We decide to study together at the library tomorrow.', ['明日は図書館で','あしたはとしょかんで'], ['一緒に','いっしょに'], ['勉強することにしました。','べんきょうすることにしました']),
    ],
  ],
  'n5-convenience-store': [
    [
      line('The shop is bright, clean and open all day.', ['その店は','そのみせは'], ['明るくて','あかるくて'], ['一日中開いています。','いちにちじゅうあいています']),
      line('There are drinks, sandwiches, fruit and hot food near the door.', ['入口の近くに','いりぐちのちかくに'], ['飲み物や果物が','のみものやくだものが'], ['たくさんあります。','たくさんあります']),
    ],
    [
      line('I look at the prices before choosing what to buy.', ['買う物を','かうものを'], ['決める前に','きめるまえに'], ['値段を見ます。','ねだんをみます']),
      line('Today, a new kind of rice ball is on sale.', ['今日は','きょうは'], ['新しいおにぎりが','あたらしいおにぎりが'], ['安くなっています。','やすくなっています']),
    ],
    [
      line('I take one rice ball, a banana and a bottle of tea.', ['おにぎりを一つ','おにぎりをひとつ'], ['バナナと','ばななと'], ['お茶を買います。','おちゃをかいます']),
      line('At the counter, the staff asks whether I need a bag.', ['レジで店員さんは','れじでてんいんさんは'], ['袋がいるか','ふくろがいるか'], ['聞きました。','ききました']),
    ],
    [
      line('I say that I brought my own bag and pay with cash.', ['自分の袋があると','じぶんのふくろがあると'], ['言って','いって'], ['現金で払いました。','げんきんではらいました']),
      line('I put the receipt away and walk to the bus stop.', ['レシートをしまって','れしーとをしまって'], ['バス停まで','ばすていまで'], ['歩いて行きます。','あるいていきます']),
    ],
  ],
  'n5-school-library': [
    [
      line('On the first floor, there are picture books for children.', ['一階には','いっかいには'], ['子どものための','こどものための'], ['絵本があります。','えほんがあります']),
      line('The second floor is quiet and has many study desks.', ['二階は','にかいは'], ['静かで','しずかで'], ['勉強する机が多いです。','べんきょうするつくえがおおいです']),
    ],
    [
      line('I choose a book with a simple story and clear pictures.', ['私は','わたしは'], ['絵がきれいで','えがきれいで'], ['読みやすい本を選びます。','よみやすいほんをえらびます']),
      line('When I find a new word, I check it in a dictionary.', ['知らない言葉を','しらないことばを'], ['見つけた時は','みつけたときは'], ['辞書で調べます。','じしょでしらべます']),
    ],
    [
      line('A librarian helps me find a book about Japanese food.', ['司書さんが','ししょさんが'], ['日本の食べ物の本を','にほんのたべもののほんを'], ['探してくれました。','さがしてくれました']),
      line('I borrow the book and write the return date on my calendar.', ['その本を借りて','そのほんをかりて'], ['返す日を','かえすひを'], ['カレンダーに書きます。','かれんだーにかきます']),
    ],
    [
      line('Before I leave, I put the chair back in its place.', ['帰る前に','かえるまえに'], ['使った椅子を','つかったいすを'], ['元の場所に戻します。','もとのばしょにもどします']),
      line('The library closes at six, so I leave before that time.', ['図書館は六時に','としょかんはろくじに'], ['閉まりますから','しまりますから'], ['その前に帰ります。','そのまえにかえります']),
    ],
  ],
  'n5-train-ride': [
    [
      line('At each station, the doors open on the left side.', ['駅に着くと','えきにつくと'], ['左側のドアが','ひだりがわのどあが'], ['開きます。','ひらきます']),
      line('People get off first, and then the waiting passengers get on.', ['先に','さきに'], ['降りる人が出て','おりるひとがでて'], ['それから乗ります。','それからのります']),
    ],
    [
      line('A small screen shows the next station and the time.', ['車内の画面に','しゃないのがめんに'], ['次の駅と','つぎのえきと'], ['時間が出ています。','じかんがでています']),
      line('I look at the map so that I do not miss my stop.', ['降りる駅を','おりるえきを'], ['間違えないように','まちがえないように'], ['地図を見ます。','ちずをみます']),
    ],
    [
      line('An older woman gets on with a heavy shopping bag.', ['お年寄りの女性が','おとしよりのじょせいが'], ['重い買い物袋を','おもいかいものぶくろを'], ['持って乗ってきました。','もってのってきました']),
      line('I stand up and offer her my seat.', ['私は立って','わたしはたって'], ['その女性に','そのじょせいに'], ['席をゆずりました。','せきをゆずりました']),
    ],
    [
      line('She smiles and thanks me before sitting down.', ['女性は','じょせいは'], ['笑って','わらって'], ['ありがとうと言いました。','ありがとうといいました']),
      line('When my station arrives, I check my bag and get off.', ['駅に着いたら','えきについたら'], ['かばんを確かめて','かばんをたしかめて'], ['電車を降ります。','でんしゃをおります']),
    ],
  ],
  'n5-park-weekend': [
    [
      line('The park has a pond, a playground and a long walking path.', ['公園には','こうえんには'], ['池や遊び場や','いけやあそびばや'], ['長い道があります。','ながいみちがあります']),
      line('Many families come here when the weather is good.', ['天気がいい日は','てんきがいいひは'], ['たくさんの家族が','たくさんのかぞくが'], ['ここへ来ます。','ここへきます']),
    ],
    [
      line('My friend brings a ball, and we play near the grass.', ['友達は','ともだちは'], ['ボールを持ってきて','ぼーるをもってきて'], ['芝生の近くで遊びます。','しばふのちかくであそびます']),
      line('After playing, we buy cold drinks from a small shop.', ['遊んだ後で','あそんだあとで'], ['小さい店で','ちいさいみせで'], ['冷たい飲み物を買います。','つめたいのみものをかいます']),
    ],
    [
      line('A little dog runs after a bird, but the bird flies away.', ['小さい犬が','ちいさいいぬが'], ['鳥を追いかけますが','とりをおいかけますが'], ['鳥は飛んで行きました。','とりはとんでいきました']),
      line('We sit on a bench and watch the children play.', ['ベンチに座って','べんちにすわって'], ['子どもたちが','こどもたちが'], ['遊ぶのを見ます。','あそぶのをみます']),
    ],
    [
      line('The sun begins to go down, and the air becomes cool.', ['夕方になると','ゆうがたになると'], ['日が少しずつ','ひがすこしずつ'], ['沈んで涼しくなります。','しずんですずしくなります']),
      line('We promise to come back next Sunday.', ['私たちは','わたしたちは'], ['来週の日曜日も','らいしゅうのにちようびも'], ['また来ると約束しました。','またくるとやくそくしました']),
    ],
  ],
  'n5-family-dinner': [
    [
      line('Before dinner, my younger brother helps wash the vegetables.', ['晩ご飯の前に','ばんごはんのまえに'], ['弟が野菜を','おとうとがやさいを'], ['洗うのを手伝います。','あらうのをてつだいます']),
      line('My mother explains how to cut the carrots safely.', ['母は','ははは'], ['にんじんの切り方を','にんじんのきりかたを'], ['ゆっくり教えます。','ゆっくりおしえます']),
    ],
    [
      line('The smell of food comes from the kitchen.', ['台所から','だいどころから'], ['おいしい料理の','おいしいりょうりの'], ['においがします。','においがします']),
      line('My father returns home and puts his bag by the door.', ['父が家に帰ると','ちちがいえにかえると'], ['かばんを','かばんを'], ['入口の横に置きます。','いりぐちのよこにおきます']),
    ],
    [
      line('We talk about school, work and the plans for tomorrow.', ['食事をしながら','しょくじをしながら'], ['学校や仕事や','がっこうやしごとや'], ['明日の予定を話します。','あしたのよていをはなします']),
      line('My brother tells a funny story, and everyone laughs.', ['弟がおもしろい話をすると','おとうとがおもしろいはなしをすると'], ['みんな','みんな'], ['大きな声で笑います。','おおきなこえでわらいます']),
    ],
    [
      line('After eating, we put the dishes in the sink together.', ['食べ終わったら','たべおわったら'], ['みんなで皿を','みんなでさらを'], ['流しに運びます。','ながしにはこびます']),
      line('I wash the plates while my brother dries them.', ['私は皿を洗い','わたしはさらをあらい'], ['弟は','おとうとは'], ['皿をふきます。','さらをふきます']),
    ],
  ],
  'n5-weather-rain': [
    [
      line('The weather report says that rain will continue until evening.', ['天気予報では','てんきよほうでは'], ['夕方まで','ゆうがたまで'], ['雨が続くそうです。','あめがつづくそうです']),
      line('I change my plan and decide to stay inside.', ['それで','それで'], ['外へ行く予定を','そとへいくよていを'], ['変えることにしました。','かえることにしました']),
    ],
    [
      line('I make a warm cup of tea and open my book.', ['温かいお茶を','あたたかいおちゃを'], ['一杯作って','いっぱいつくって'], ['本を開きます。','ほんをひらきます']),
      line('The sound of rain on the window is quiet and pleasant.', ['窓に当たる雨の音は','まどにあたるあめのおとは'], ['静かで','しずかで'], ['気持ちがいいです。','きもちがいいです']),
    ],
    [
      line('Later, the rain becomes weaker and the clouds begin to move.', ['しばらくすると','しばらくすると'], ['雨が弱くなり','あめがよわくなり'], ['雲が動き始めます。','くもがうごきはじめます']),
      line('A little sunlight comes through the clouds.', ['雲の間から','くものあいだから'], ['少しだけ','すこしだけ'], ['太陽の光が見えます。','たいようのひかりがみえます']),
    ],
    [
      line('I take my umbrella and go outside for a short walk.', ['傘を持って','かさをもって'], ['近くの道を','ちかくのみちを'], ['少し歩きます。','すこしあるきます']),
      line('The trees look green, and the air smells clean.', ['木の葉は','このはは'], ['いつもより','いつもより'], ['緑に見えて空気もきれいです。','みどりにみえてくうきもきれいです']),
    ],
  ],
  'n5-clothes-shopping': [
    [
      line('The shop has many jackets in different colours and sizes.', ['店には','みせには'], ['色や大きさが','いろやおおきさが'], ['違う上着があります。','ちがううわぎがあります']),
      line('I ask a shop assistant where the changing room is.', ['店員さんに','てんいんさんに'], ['試着する部屋は','しちゃくするへやは'], ['どこか聞きました。','どこかききました']),
    ],
    [
      line('The blue jacket looks good, but the sleeves are too long.', ['青い上着は','あおいうわぎは'], ['よく見えますが','よくみえますが'], ['そでは長すぎます。','そではながすぎます']),
      line('I try a smaller size and check it in the mirror.', ['小さいサイズを','ちいさいさいずを'], ['着てみて','きてみて'], ['鏡で確かめます。','かがみでたしかめます']),
    ],
    [
      line('My sister says that the black one matches my trousers.', ['妹は','いもうとは'], ['黒い上着が','くろいうわぎが'], ['ズボンに合うと言います。','ずぼんにあうといいます']),
      line('I look at the price tag and decide to buy it.', ['値札を見て','ねふだをみて'], ['その上着を','そのうわぎを'], ['買うことにしました。','かうことにしました']),
    ],
    [
      line('At home, I hang the jacket carefully in my room.', ['家に帰ってから','いえにかえってから'], ['上着を','うわぎを'], ['部屋にかけます。','へやにかけます']),
      line('I am happy because I found something comfortable.', ['着やすい服が','きやすいふくが'], ['見つかって','みつかって'], ['うれしいです。','うれしいです']),
    ],
  ],
  'n5-friends-cafe': [
    [
      line('The café is busy, but we find a table near the window.', ['カフェは','かふぇは'], ['人が多いですが','ひとがおおいですが'], ['窓の近くに席を見つけました。','まどのちかくにせきをみつけました']),
      line('There is a menu on the table with pictures of the drinks.', ['テーブルの上に','てーぶるのうえに'], ['飲み物の写真が','のみもののしゃしんが'], ['あるメニューがあります。','あるめにゅーがあります']),
    ],
    [
      line('My friend tells me about a new class at school.', ['友達は','ともだちは'], ['学校の新しい授業に','がっこうのあたらしいじゅぎょうに'], ['ついて話します。','ついてはなします']),
      line('I listen carefully and ask a few questions.', ['私は','わたしは'], ['よく聞いて','よくきいて'], ['いくつか質問します。','いくつかしつもんします']),
    ],
    [
      line('We share a small cake because it is large for one person.', ['ケーキは','けーきは'], ['一人には大きいので','ひとりにはおおきいので'], ['二人で分けます。','ふたりでわけます']),
      line('The café plays soft music, and the room feels peaceful.', ['カフェでは','かふぇでは'], ['静かな音楽が','しずかなおんがくが'], ['流れていて落ち着きます。','ながれていておちつきます']),
    ],
    [
      line('Before we leave, we make a plan to meet again next week.', ['帰る前に','かえるまえに'], ['来週も会う','らいしゅうもあう'], ['約束をしました。','やくそくをしました']),
      line('We thank the staff and walk back to the station.', ['店員さんに','てんいんさんに'], ['ありがとうと言って','ありがとうといって'], ['駅まで歩きます。','えきまであるきます']),
    ],
  ],
  'n5-post-office': [
    [
      line('At the post office, I take a number and wait in line.', ['郵便局に入って','ゆうびんきょくにはいって'], ['番号を取って','ばんごうをとって'], ['順番を待ちます。','じゅんばんをまちます']),
      line('There are forms for letters and small packages near the desk.', ['窓口の近くに','まどぐちのちかくに'], ['手紙や荷物の','てがみやにもつの'], ['用紙があります。','ようしがあります']),
    ],
    [
      line('The staff member asks whether the letter is important.', ['局員さんは','きょくいんさんは'], ['この手紙が','このてがみが'], ['大切な物か聞きます。','たいせつなものかききます']),
      line('I choose a service that will deliver it quickly.', ['早く届く','はやくとどく'], ['送り方を','おくりかたを'], ['選びました。','えらびました']),
    ],
    [
      line('I write the address carefully so that it is easy to read.', ['住所を','じゅうしょを'], ['読みやすいように','よみやすいように'], ['ていねいに書きます。','ていねいにかきます']),
      line('The staff checks the stamp and gives me a receipt.', ['局員さんは','きょくいんさんは'], ['切手を確かめて','きってをたしかめて'], ['レシートをくれます。','れしーとをくれます']),
    ],
    [
      line('I send a short message to my friend to say the letter is on its way.', ['手紙を送った後','てがみをおくったあと'], ['友達に','ともだちに'], ['知らせを送りました。','しらせをおくりました']),
      line('I hope the letter arrives safely in a few days.', ['何日か後に','なんにちかあとに'], ['手紙が無事に','てがみがぶじに'], ['届くといいです。','とどくといいです']),
    ],
  ],
  'n5-at-the-clinic': [
    [
      line('At the clinic, I write my name and address on a form.', ['病院に着くと','びょういんにつくと'], ['名前と住所を','なまえとじゅうしょを'], ['紙に書きます。','かみにかきます']),
      line('The nurse asks me to wait until the doctor is ready.', ['看護師さんは','かんごしさんは'], ['医者の準備が','いしゃのじゅんびが'], ['できるまで待ってくださいと言います。','できるまでまってくださいといいます']),
    ],
    [
      line('I explain where my head hurts and when it began.', ['頭のどこが','あたまのどこが'], ['いつから痛いか','いつからいたいか'], ['説明します。','せつめいします']),
      line('The doctor listens and checks my temperature.', ['医者は','いしゃは'], ['話を聞いて','はなしをきいて'], ['熱を調べます。','ねつをしらべます']),
    ],
    [
      line('The doctor says that I should sleep early tonight.', ['今夜は','こんやは'], ['早く寝たほうが','はやくねたほうが'], ['いいと言われました。','いいといわれました']),
      line('I receive some medicine and ask how to take it.', ['薬をもらって','くすりをもらって'], ['飲み方を','のみかたを'], ['聞きました。','ききました']),
    ],
    [
      line('On the way home, I buy water and something easy to eat.', ['帰りに','かえりに'], ['水と','みずと'], ['食べやすい物を買います。','たべやすいものをかいます']),
      line('I plan to rest and return to school when I feel better.', ['ゆっくり休んで','ゆっくりやすんで'], ['元気になったら','げんきになったら'], ['学校へ行きます。','がっこうへいきます']),
    ],
  ],
  'n5-photography-hobby': [
    [
      line('I learned how to use the camera by watching a short video.', ['短い動画を見て','みじかいどうがをみて'], ['カメラの使い方を','かめらのつかいかたを'], ['勉強しました。','べんきょうしました']),
      line('I practise taking pictures at different times of the day.', ['一日の中で','いちにちのなかで'], ['時間を変えて','じかんをかえて'], ['写真を撮ります。','しゃしんをとります']),
    ],
    [
      line('In the morning, the light is soft and the colours look clear.', ['朝は','あさは'], ['光がやわらかく','ひかりがやわらかく'], ['色がきれいに見えます。','いろがきれいにみえます']),
      line('At noon, I look for shade so that the picture is not too bright.', ['昼は','ひるは'], ['写真が明るすぎないように','しゃしんがあかるすぎないように'], ['日かげを探します。','ひかげをさがします']),
    ],
    [
      line('My friend shows me how to hold the camera steadily.', ['友達は','ともだちは'], ['カメラを安定して','かめらをあんていして'], ['持つ方法を教えます。','もつほうほうをおしえます']),
      line('I take several pictures and choose the best one later.', ['何枚か写真を撮って','なんまいかしゃしんをとって'], ['後で','あとで'], ['一番いい物を選びます。','いちばんいいものをえらびます']),
    ],
    [
      line('I keep the pictures in a folder and write the date on it.', ['写真をフォルダーに入れて','しゃしんをふぉるだーにいれて'], ['日付を','ひづけを'], ['書いておきます。','かいておきます']),
      line('This hobby helps me notice small things around me.', ['この趣味で','このしゅみで'], ['まわりの小さなことに','まわりのちいさなことに'], ['気が付くようになりました。','きがつくようになりました']),
    ],
  ],

  'n4-new-apartment': [
    [
      line('On the first evening, I unpacked the boxes and arranged the furniture.', ['最初の晩に','さいしょのばんに'], ['箱を開けて','はこをあけて'], ['家具を並べました。','かぐをならべました']),
      line('I put the desk beside the window because I like studying in natural light.', ['自然の光で','しぜんのひかりで'], ['勉強するのが好きなので','べんきょうするのがすきなので'], ['机を窓の横に置きました。','つくえをまどのよこにおきました']),
    ],
    [
      line('The apartment building has a shared room where residents can leave deliveries.', ['建物には','たてものには'], ['住んでいる人が','すんでいるひとが'], ['荷物を受け取る場所があります。','にもつをうけとるばしょがあります']),
      line('I asked the manager how to separate rubbish and where to put it.', ['管理人に','かんりにんに'], ['ごみの分け方と','ごみのわけかたと'], ['出す場所を聞きました。','だすばしょをききました']),
    ],
    [
      line('The neighbour next door introduced herself and welcomed me to the building.', ['隣の部屋の人が','となりのへやのひとが'], ['自己紹介をして','じこしょうかいをして'], ['この建物へようこそと言いました。','このたてものへようこそといいました']),
      line('She told me which supermarket has fresh vegetables at a good price.', ['その人は','そのひとは'], ['野菜が新鮮で','やさいがしんせんで'], ['安いスーパーを教えてくれました。','やすいすーぱーをおしえてくれました']),
    ],
    [
      line('During the weekend, I walked around the area to find useful places.', ['週末に','しゅうまつに'], ['近所の便利な場所を','きんじょのべんりなばしょを'], ['探して歩きました。','さがしてあるきました']),
      line('I found a pharmacy, a small park and a café near the station.', ['駅の近くに','えきのちかくに'], ['薬局や小さな公園や','やっきょくやちいさなこうえんや'], ['カフェがありました。','かふぇがありました']),
    ],
    [
      line('I still have a few boxes to open, but the room is beginning to feel like home.', ['まだ開けていない箱が','まだあけていないはこが'], ['少しありますが','すこしありますが'], ['部屋は家らしくなってきました。','へやはいえらしくなってきました']),
      line('I want to learn the neighbourhood well and greet the people who live here.', ['この町のことを','このまちのことを'], ['よく知って','よくしって'], ['住んでいる人にあいさつしたいです。','すんでいるひとにあいさつしたいです']),
    ],
  ],
  'n4-part-time-job': [
    [
      line('On my first day, the manager showed me the kitchen and explained the rules.', ['初めての日に','はじめてのひに'], ['店長は','てんちょうは'], ['台所と仕事の規則を説明しました。','だいどころとしごとのきそくをせつめいしました']),
      line('I learned where to keep the cups, plates and cleaning tools.', ['コップや皿や','こっぷやさらや'], ['掃除の道具を','そうじのどうぐを'], ['どこに置くか習いました。','どこにおくかならいました']),
    ],
    [
      line('When customers enter, we greet them clearly and show them to a table.', ['お客さんが入ってきたら','おきゃくさんがはいってきたら'], ['はっきりあいさつして','はっきりあいさつして'], ['席まで案内します。','せきまであんないします']),
      line('If I do not understand an order, I ask a senior worker to confirm it.', ['注文が分からない時は','ちゅうもんがわからないときは'], ['先輩に','せんぱいに'], ['もう一度確かめてもらいます。','もういちどたしかめてもらいます']),
    ],
    [
      line('The busiest time is around lunch, when many office workers come in.', ['一番忙しい時間は','いちばんいそがしいじかんは'], ['昼ごろで','ひるごろで'], ['会社の人がたくさん来ます。','かいしゃのひとがたくさんきます']),
      line('We work together so that every customer receives the correct meal.', ['お客さんに','おきゃくさんに'], ['正しい料理を','ただしいりょうりを'], ['出せるように協力します。','だせるようにきょうりょくします']),
    ],
    [
      line('After closing, we clean the tables and check the remaining supplies.', ['店を閉めた後','みせをしめたあと'], ['テーブルを掃除して','てーぶるをそうじして'], ['残っている物を調べます。','のこっているものをしらべます']),
      line('The manager gives us a short meeting to talk about the day.', ['店長は','てんちょうは'], ['その日の仕事について','そのひのしごとについて'], ['短い会議をします。','みじかいかいぎをします']),
    ],
    [
      line('I sometimes make mistakes, but I write them down and practise again.', ['時々間違えますが','ときどきまちがえますが'], ['間違えたことを','まちがえたことを'], ['書いてもう一度練習します。','かいてもういちどれんしゅうします']),
      line('I am becoming more confident because the other workers help me.', ['ほかの人が','ほかのひとが'], ['助けてくれるので','たすけてくれるので'], ['少し自信が出てきました。','すこしじしんがでてきました']),
    ],
  ],
  'n4-hotel-reservation': [
    [
      line('I chose the hotel because it is close to the station and the city centre.', ['駅と町の中心に','えきとまちのちゅうしんに'], ['近いので','ちかいので'], ['このホテルを選びました。','このほてるをえらびました']),
      line('Before travelling, I checked the cancellation rules and breakfast hours.', ['旅行の前に','りょこうのまえに'], ['キャンセルの規則と','きゃんせるのきそくと'], ['朝食の時間を確認しました。','ちょうしょくのじかんをかくにんしました']),
    ],
    [
      line('At check-in, the receptionist asked me to show my identification.', ['チェックインの時','ちぇっくいんのとき'], ['受付の人は','うけつけのひとは'], ['身分証明書を見せてくださいと言いました。','みぶんしょうめいしょをみせてくださいといいました']),
      line('I confirmed the number of nights and the type of room I had booked.', ['泊まる日数と','とまるにっすうと'], ['予約した部屋の種類を','よやくしたへやのしゅるいを'], ['もう一度確かめました。','もういちどたしかめました']),
    ],
    [
      line('The receptionist explained where the lift and emergency stairs were.', ['受付の人は','うけつけのひとは'], ['エレベーターと','えれべーたーと'], ['非常階段の場所を説明しました。','ひじょうかいだんのばしょをせつめいしました']),
      line('They also told me that the restaurant would be busy after seven.', ['レストランは','れすとらんは'], ['七時を過ぎると','しちじをすぎると'], ['混むそうです。','こむそうです']),
    ],
    [
      line('After leaving my luggage in the room, I asked about nearby places to eat.', ['部屋に荷物を置いてから','へやににもつをおいてから'], ['近くで食事ができる場所を','ちかくでしょくじができるばしょを'], ['聞きました。','ききました']),
      line('The staff recommended a small restaurant that serves local dishes.', ['スタッフは','すたっふは'], ['地元の料理を出す','じもとのりょうりをだす'], ['小さな店をすすめてくれました。','ちいさなみせをすすめてくれました']),
    ],
    [
      line('The room was quiet, and I could see the city lights from the window.', ['部屋は静かで','へやはしずかで'], ['窓から','まどから'], ['町の明かりが見えました。','まちのあかりがみえました']),
      line('I wrote down the next day’s plans before going to sleep.', ['寝る前に','ねるまえに'], ['次の日の予定を','つぎのひのよていを'], ['ノートに書きました。','のーとにかきました']),
    ],
  ],
  'n4-lost-property': [
    [
      line('I checked my pockets and suitcase, but the umbrella was not there.', ['ポケットとスーツケースを','ぽけっととすーつけーすを'], ['調べましたが','しらべましたが'], ['傘は見つかりませんでした。','かさはみつかりませんでした']),
      line('I remembered that I had changed trains at the central station.', ['中央駅で','ちゅうおうえきで'], ['電車を乗り換えた','でんしゃをのりかえた'], ['ことを思い出しました。','ことをおもいだしました']),
    ],
    [
      line('At the station office, a worker asked me for the train and time.', ['駅の事務室で','えきのじむしつで'], ['係の人は','かかりのひとは'], ['電車と時間を聞きました。','でんしゃとじかんをききました']),
      line('I described the colour, size and handle of the umbrella.', ['傘の色と大きさと','かさのいろとおおきさと'], ['持つところの形を','もつところのかたちを'], ['説明しました。','せつめいしました']),
    ],
    [
      line('The worker searched the lost-property list on a computer.', ['係の人は','かかりのひとは'], ['コンピューターで','こんぴゅーたーで'], ['忘れ物のリストを調べました。','わすれもののりすとをしらべました']),
      line('There were several umbrellas, so I had to give more details.', ['傘がいくつかあったので','かさがいくつかあったので'], ['もう少し詳しく','もうすこしくわしく'], ['話す必要がありました。','はなすひつようがありました']),
    ],
    [
      line('Luckily, one umbrella had the same small mark near its handle.', ['幸い','さいわい'], ['持つところの近くに','もつところのちかくに'], ['同じ印がありました。','おなじしるしがありました']),
      line('I showed my identification and received it from the office.', ['身分証明書を見せて','みぶんしょうめいしょをみせて'], ['事務室で','じむしつで'], ['傘を受け取りました。','かさをうけとりました']),
    ],
    [
      line('I thanked the worker and decided to write my name on it next time.', ['係の人にお礼を言って','かかりのひとにおれいをいって'], ['次からは','つぎからは'], ['名前を書こうと思いました。','なまえをかこうとおもいました']),
      line('I was relieved that a small problem had been solved so easily.', ['小さな問題が','ちいさなもんだいが'], ['無事に解決して','ぶじにかいけつして'], ['安心しました。','あんしんしました']),
    ],
  ],
  'n4-local-festival': [
    [
      line('A few days before the festival, volunteers decorate the street with lanterns.', ['祭りの数日前に','まつりのすうじつまえに'], ['ボランティアが','ぼらんてぃあが'], ['通りにちょうちんを飾ります。','とおりにちょうちんをかざります']),
      line('Local shops prepare special food and drinks for visitors.', ['近くの店は','ちかくのみせは'], ['来る人のために','くるひとのために'], ['特別な食べ物を用意します。','とくべつなたべものをよういします']),
    ],
    [
      line('In the afternoon, families gather near the shrine entrance.', ['午後になると','ごごになると'], ['家族が','かぞくが'], ['神社の入口に集まります。','じんじゃのいりぐちにあつまります']),
      line('Children enjoy games while adults meet their neighbours.', ['子どもたちはゲームを楽しみ','こどもたちはげーむをたのしみ'], ['大人は','おとなは'], ['近所の人と話します。','きんじょのひととはなします']),
    ],
    [
      line('A group of musicians plays traditional music near the main road.', ['音楽をする人たちが','おんがくをするひとたちが'], ['大きな道の近くで','おおきなみちのちかくで'], ['伝統的な音楽を演奏します。','でんとうてきなおんがくをえんそうします']),
      line('The sound can be heard from far away, and more people come.', ['その音は','そのおとは'], ['遠くまで聞こえて','とおくまできこえて'], ['人がもっと集まります。','ひとがもっとあつまります']),
    ],
    [
      line('Before the fireworks begin, people find a safe place to stand.', ['花火が始まる前に','はなびがはじまるまえに'], ['人々は','ひとびとは'], ['安全な場所を探します。','あんぜんなばしょをさがします']),
      line('The sky becomes bright for a short time when the fireworks open.', ['花火が上がると','はなびがあがると'], ['空は','そらは'], ['少しの間明るくなります。','すこしのあいだあかるくなります']),
    ],
    [
      line('After the festival, volunteers collect rubbish and put the chairs away.', ['祭りの後で','まつりのあとで'], ['ボランティアは','ぼらんてぃあは'], ['ごみを集めて椅子を片付けます。','ごみをあつめていすをかたづけます']),
      line('Everyone is tired, but they are already looking forward to next year.', ['みんな疲れていますが','みんなつかれていますが'], ['来年の祭りを','らいねんのまつりを'], ['もう楽しみにしています。','もうたのしみにしています']),
    ],
  ],
  'n4-cooking-curry': [
    [
      line('Before cooking, we checked the recipe and prepared all the ingredients.', ['料理を始める前に','りょうりをはじめるまえに'], ['レシピを確認して','れしぴをかくにんして'], ['材料を全部用意しました。','ざいりょうをぜんぶよういしました']),
      line('My brother washed the vegetables while I prepared the meat.', ['兄が野菜を洗い','あにがやさいをあらい'], ['私は','わたしは'], ['肉の準備をしました。','にくのじゅんびをしました']),
    ],
    [
      line('We cut the vegetables into pieces that were almost the same size.', ['野菜は','やさいは'], ['大きさが同じくらいに','おおきさがおなじくらいに'], ['なるように切りました。','なるようにきりました']),
      line('This helps everything cook at nearly the same speed.', ['そうすると','そうすると'], ['全部の材料に','ぜんぶのざいりょうに'], ['同じくらい火が通ります。','おなじくらいひがとおります']),
    ],
    [
      line('When the onions became soft, we added the meat to the pot.', ['玉ねぎが柔らかくなった時','たまねぎがやわらかくなったとき'], ['鍋に','なべに'], ['肉を入れました。','にくをいれました']),
      line('We stirred it slowly so that nothing would burn.', ['何も焦げないように','なにもこげないように'], ['ゆっくり','ゆっくり'], ['かき混ぜました。','かきまぜました']),
    ],
    [
      line('After adding water, we waited until the vegetables were soft.', ['水を入れてから','みずをいれてから'], ['野菜が柔らかく','やさいがやわらかく'], ['なるまで待ちました。','なるまでまちました']),
      line('My brother tasted the sauce and said it needed a little salt.', ['兄がソースを味見すると','あにがそーすをあじみすると'], ['塩が少し','しおがすこし'], ['足りないと言いました。','たりないといいました']),
    ],
    [
      line('We ate the curry with rice and a simple salad.', ['カレーを','かれーを'], ['ご飯と','ごはんと'], ['簡単なサラダと一緒に食べました。','かんたんなさらだといっしょにたべました']),
      line('The meal tasted better because we had made it together.', ['一緒に作ったので','いっしょにつくったので'], ['いつもより','いつもより'], ['おいしく感じました。','おいしくかんじました']),
    ],
  ],
  'n4-school-project': [
    [
      line('Our teacher explained the goal and the date of the presentation.', ['先生は','せんせいは'], ['発表の目的と','はっぴょうのもくてきと'], ['日にちを説明しました。','ひにちをせつめいしました']),
      line('Each group had to choose a subject that everyone found interesting.', ['それぞれのグループは','それぞれのぐるーぷは'], ['みんなが興味を持つ','みんながきょうみをもつ'], ['テーマを選ぶ必要がありました。','てーまをえらぶひつようがありました']),
    ],
    [
      line('We chose local festivals because they show many parts of Japanese culture.', ['日本の文化の','にほんのぶんかの'], ['いろいろなところが分かるので','いろいろなところがわかるので'], ['地元の祭りを選びました。','じもとのまつりをえらびました']),
      line('I visited the library to find books and reliable information.', ['図書館へ行って','としょかんへいって'], ['本と','ほんと'], ['正しい情報を探しました。','ただしいじょうほうをさがしました']),
    ],
    [
      line('Another student interviewed a family who helps organise the festival.', ['別の学生は','べつのがくせいは'], ['祭りの準備をする','まつりのじゅんびをする'], ['家族に話を聞きました。','かぞくにはなしをききました']),
      line('We compared our notes and removed information that was repeated.', ['みんなのノートを比べて','みんなののーとをくらべて'], ['同じ内容を','おなじないようを'], ['整理しました。','せいりしました']),
    ],
    [
      line('I made slides with photographs and short explanations.', ['私は','わたしは'], ['写真と短い説明を','しゃしんとみじかいせつめいを'], ['使ってスライドを作りました。','つかってすらいどをつくりました']),
      line('We practised speaking slowly so that the class could understand us.', ['クラスのみんなに','くらすのみんなに'], ['分かってもらえるように','わかってもらえるように'], ['ゆっくり話す練習をしました。','ゆっくりはなすれんしゅうをしました']),
    ],
    [
      line('On presentation day, I was nervous but remembered the main points.', ['発表の日は','はっぴょうのひは'], ['緊張しましたが','きんちょうしましたが'], ['大切な点を思い出しました。','たいせつなてんをおもいだしました']),
      line('The teacher praised our teamwork and suggested one improvement.', ['先生は','せんせいは'], ['チームワークをほめて','ちーむわーくをほめて'], ['一つアドバイスをくれました。','ひとつあどばいすをくれました']),
    ],
  ],
  'n4-neighbourhood-cleanup': [
    [
      line('The local group sends a message before each clean-up day.', ['地域のグループは','ちいきのぐるーぷは'], ['掃除の日の前に','そうじのひのまえに'], ['連絡を送ります。','れんらくをおくります']),
      line('The message explains where to meet and what tools to bring.', ['集合する場所と','しゅうごうするばしょと'], ['持ってくる道具を','もってくるどうぐを'], ['説明しています。','せつめいしています']),
    ],
    [
      line('When I arrive, the leader gives everyone gloves and rubbish bags.', ['着くと','つくと'], ['リーダーは','りーだーは'], ['みんなに手袋と袋を渡します。','みんなにてぶくろとふくろをわたします']),
      line('We make small groups so that each street can be cleaned.', ['道をきれいにするために','みちをきれいにするために'], ['小さなグループに','ちいさなぐるーぷに'], ['分かれます。','わかれます']),
    ],
    [
      line('Some people pick up rubbish while others sweep the sidewalks.', ['ごみを拾う人もいれば','ごみをひろうひともいれば'], ['歩道を掃く人も','ほどうをはくひとも'], ['います。','います']),
      line('We separate bottles and cans before putting them into the bags.', ['袋に入れる前に','ふくろにいれるまえに'], ['びんと缶を','びんとかんを'], ['分けておきます。','わけておきます']),
    ],
    [
      line('A shop owner brings water for the volunteers because the day is hot.', ['その日は暑かったので','そのひはあつかったので'], ['店の人が','みせのひとが'], ['ボランティアに水をくれました。','ぼらんてぃあにみずをくれました']),
      line('I spoke with a neighbour whom I had never met before.', ['今まで会ったことのない','いままであったことのない'], ['近所の人と','きんじょのひとと'], ['話をしました。','はなしをしました']),
    ],
    [
      line('The streets looked cleaner, and everyone felt pleased with the result.', ['道がきれいになって','みちがきれいになって'], ['みんな','みんな'], ['結果に満足しました。','けっかにまんぞくしました']),
      line('We decided to continue the activity every month.', ['この活動を','このかつどうを'], ['毎月','まいつき'], ['続けることにしました。','つづけることにしました']),
    ],
  ],
  'n4-medical-appointment': [
    [
      line('The receptionist asked for my name, date of birth and health card.', ['受付の人は','うけつけのひとは'], ['名前と生年月日と','なまえとせいねんがっぴと'], ['保険証を確認しました。','ほけんしょうをかくにんしました']),
      line('I explained that the pain was stronger in the morning.', ['痛みは','いたみは'], ['朝になると','あさになると'], ['強くなると説明しました。','つよくなるとせつめいしました']),
    ],
    [
      line('The doctor asked whether I had taken any medicine already.', ['医者は','いしゃは'], ['もう薬を飲んだか','もうくすりをのんだか'], ['どうか聞きました。','どうかききました']),
      line('I described the medicine and the time when I had taken it.', ['飲んだ薬と','のんだくすりと'], ['飲んだ時間を','のんだじかんを'], ['説明しました。','せつめいしました']),
    ],
    [
      line('After checking my throat, the doctor explained what might be causing the pain.', ['喉を調べた後','のどをしらべたあと'], ['医者は','いしゃは'], ['痛みの原因を説明しました。','いたみのげんいんをせつめいしました']),
      line('The doctor recommended drinking water and getting enough sleep.', ['水を飲んで','みずをのんで'], ['十分に','じゅうぶんに'], ['寝るようにすすめられました。','ねるようにすすめられました']),
    ],
    [
      line('I asked which symptoms would mean that I should return to the clinic.', ['どんな症状が出たら','どんなしょうじょうがでたら'], ['もう一度','もういちど'], ['来たほうがいいか聞きました。','きたほうがいいかききました']),
      line('The doctor wrote the instructions on a piece of paper.', ['医者は','いしゃは'], ['説明を','せつめいを'], ['紙に書いてくれました。','かみにかいてくれました']),
    ],
    [
      line('At the pharmacy, I waited while the medicine was prepared.', ['薬局で','やっきょくで'], ['薬が用意される間','くすりがよういされるあいだ'], ['待ちました。','まちました']),
      line('I checked the label carefully before leaving the pharmacy.', ['薬局を出る前に','やっきょくをでるまえに'], ['薬の説明を','くすりのせつめいを'], ['よく読みました。','よくよみました']),
    ],
  ],
  'n4-invitation-email': [
    [
      line('The email included the date, time and address of the restaurant.', ['メールには','めーるには'], ['日付と時間と','ひづけとじかんと'], ['レストランの住所が書いてありました。','れすとらんのじゅうしょがかいてありました']),
      line('My friend asked everyone to reply by Wednesday.', ['友達は','ともだちは'], ['水曜日までに','すいようびまでに'], ['返事をしてほしいと言いました。','へんじをしてほしいといいました']),
    ],
    [
      line('I checked my calendar to make sure I did not have another plan.', ['ほかの予定がないか','ほかのよていがないか'], ['カレンダーを','かれんだーを'], ['確認しました。','かくにんしました']),
      line('Then I wrote a short reply and thanked my friend for inviting me.', ['それから','それから'], ['短い返事を書いて','みじかいへんじをかいて'], ['誘ってくれたことにお礼を言いました。','さそってくれたことにおれいをいいました']),
    ],
    [
      line('I asked whether I should arrive early to help prepare the room.', ['部屋の準備を','へやのじゅんびを'], ['手伝うために','てつだうために'], ['早く行ったほうがいいか聞きました。','はやくいったほうがいいかききました']),
      line('My friend said that arriving ten minutes early would be enough.', ['友達は','ともだちは'], ['十分前に来れば','じゅっぷんまえにくれば'], ['大丈夫だと答えました。','だいじょうぶだとこたえました']),
    ],
    [
      line('On the day, I bought a small present and wrapped it at home.', ['当日は','とうじつは'], ['小さなプレゼントを買って','ちいさなぷれぜんとをかって'], ['家で包みました。','いえでつつみました']),
      line('I checked the train time and left home with plenty of time.', ['電車の時間を確かめて','でんしゃのじかんをたしかめて'], ['余裕を持って','よゆうをもって'], ['家を出ました。','いえをでました']),
    ],
    [
      line('Everyone enjoyed the food, shared stories and took photographs.', ['みんなで','みんなで'], ['料理を楽しんで','りょうりをたのしんで'], ['話をしたり写真を撮ったりしました。','はなしをしたりしゃしんをとったりしました']),
      line('I was glad that I had accepted the invitation.', ['誘いを受けて','さそいをうけて'], ['本当に','ほんとうに'], ['よかったと思いました。','よかったとおもいました']),
    ],
  ],
  'n4-train-delay': [
    [
      line('At first, passengers did not know why the train had stopped.', ['初めは','はじめは'], ['電車が止まった理由が','でんしゃがとまったりゆうが'], ['分かりませんでした。','わかりませんでした']),
      line('A few minutes later, the conductor made an announcement.', ['数分後に','すうふんごに'], ['車掌が','しゃしょうが'], ['車内放送をしました。','しゃないほうそうをしました']),
    ],
    [
      line('Some passengers checked the railway website for more information.', ['何人かの乗客は','なんにんかのじょうきゃくは'], ['鉄道会社のサイトで','てつどうがいしゃのさいとで'], ['詳しい情報を調べました。','くわしいじょうほうをしらべました']),
      line('Others called their workplaces to say that they would be late.', ['ほかの人は','ほかのひとは'], ['遅れると','おくれると'], ['職場に電話しました。','しょくばにでんわしました']),
    ],
    [
      line('The railway company offered an alternative route using another line.', ['鉄道会社は','てつどうがいしゃは'], ['別の線を使う','べつのせんをつかう'], ['方法を案内しました。','ほうほうをあんないしました']),
      line('I compared the routes and decided to change trains at the next station.', ['道順を比べて','みちじゅんをくらべて'], ['次の駅で','つぎのえきで'], ['乗り換えることにしました。','のりかえることにしました']),
    ],
    [
      line('The new route was crowded, but it continued to move normally.', ['新しい路線は','あたらしいろせんは'], ['混んでいましたが','こんでいましたが'], ['普通に動いていました。','ふつうにうごいていました']),
      line('I sent another message to explain the change in my arrival time.', ['到着する時間が変わるので','とうちゃくするじかんがかわるので'], ['もう一度','もういちど'], ['連絡を送りました。','れんらくをおくりました']),
    ],
    [
      line('Although I arrived late, my colleagues understood the situation.', ['遅れて着きましたが','おくれてつきましたが'], ['同僚は','どうりょうは'], ['事情を分かってくれました。','じじょうをわかってくれました']),
      line('I now check service information before leaving on busy mornings.', ['それからは','それからは'], ['忙しい朝に出かける前に','いそがしいあさにでかけるまえに'], ['運行情報を調べています。','うんこうじょうほうをしらべています']),
    ],
  ],
  'n4-recycling-rules': [
    [
      line('The city guide explains that each type of rubbish has a different collection day.', ['市の案内には','しのあんないには'], ['ごみの種類によって','ごみのしゅるいによって'], ['集める日が違うと書いてあります。','あつめるひがちがうとかいてあります']),
      line('Large items must be collected separately after an application.', ['大きな物は','おおきなものは'], ['申し込んだ後で','もうしこんだあとで'], ['別に集めてもらいます。','べつにあつめてもらいます']),
    ],
    [
      line('I wash plastic containers and remove the labels when necessary.', ['プラスチックの容器は','ぷらすちっくのようきは'], ['洗って','あらって'], ['必要ならラベルを取ります。','ひつようなららべるをとります']),
      line('Glass bottles and metal cans go into different collection boxes.', ['びんと缶は','びんとかんは'], ['違う回収箱に','ちがうかいしゅうばこに'], ['入れます。','いれます']),
    ],
    [
      line('At first, I found the rules confusing because there were many details.', ['初めは','はじめは'], ['細かい決まりが多くて','こまかいきまりがおおくて'], ['少し難しいと思いました。','すこしむずかしいとおもいました']),
      line('I put a simple list on the refrigerator to remember the schedule.', ['予定を忘れないように','よていをわすれないように'], ['冷蔵庫に','れいぞうこに'], ['簡単な表を貼りました。','かんたんなひょうをはりました']),
    ],
    [
      line('My neighbour explained what to do with old batteries and small electronics.', ['近所の人は','きんじょのひとは'], ['古い電池や','ふるいでんちや'], ['小さな電気製品の出し方を教えました。','ちいさなでんきせいひんのだしかたをおしえました']),
      line('These items should not be placed in the usual rubbish bag.', ['そのような物は','そのようなものは'], ['普通のごみ袋に','ふつうのごみぶくろに'], ['入れてはいけません。','いれてはいけません']),
    ],
    [
      line('Following the rules takes a little effort, but it keeps the area clean.', ['決まりを守るには','きまりをまもるには'], ['少し手間がかかりますが','すこしてまがかかりますが'], ['町をきれいにできます。','まちをきれいにできます']),
      line('I feel better knowing that useful materials can be recycled.', ['使える材料が','つかえるざいりょうが'], ['もう一度使われると','もういちどつかわれると'], ['思うとうれしいです。','おもうとうれしいです']),
    ],
  ],
  'n4-weekend-trip': [
    [
      line('We began by asking everyone how much they wanted to spend.', ['最初に','さいしょに'], ['みんなが','みんなが'], ['いくら使いたいか聞きました。','いくらつかいたいかききました']),
      line('After comparing our budgets, we chose a destination that suited everyone.', ['予算を比べた後','よさんをくらべたあと'], ['みんなに合う','みんなにあう'], ['行き先を選びました。','いきさきをえらびました']),
    ],
    [
      line('One friend searched for train tickets while another looked for hotels.', ['一人は','ひとりは'], ['電車の切符を調べ','でんしゃのきっぷをしらべ'], ['もう一人はホテルを探しました。','もうひとりはほてるをさがしました']),
      line('I made a list of places that we could visit in two days.', ['私は','わたしは'], ['二日間で行ける場所を','ふつかかんでいけるばしょを'], ['リストにしました。','りすとにしました']),
    ],
    [
      line('We checked the opening hours so that we would not arrive too late.', ['遅く着かないように','おそくつかないように'], ['観光地の','かんこうちの'], ['営業時間を確認しました。','えいぎょうじかんをかくにんしました']),
      line('We also looked at the weather and prepared clothes for rain.', ['天気も調べて','てんきもしらべて'], ['雨に備えて','あめにそなえて'], ['服を用意しました。','ふくをよういしました']),
    ],
    [
      line('On the day of departure, everyone arrived at the station on time.', ['出発の日','しゅっぱつのひ'], ['みんな','みんな'], ['時間どおりに駅へ来ました。','じかんどおりにえきへきました']),
      line('We bought snacks for the journey and checked our tickets again.', ['旅行のために','りょこうのために'], ['お菓子を買って','おかしをかって'], ['切符をもう一度確認しました。','きっぷをもういちどかくにんしました']),
    ],
    [
      line('The trip was relaxing because we had planned the important details.', ['大切なことを','たいせつなことを'], ['前もって決めていたので','まえもってきめていたので'], ['旅行をゆっくり楽しめました。','りょこうをゆっくりたのしめました']),
      line('On the way home, we talked about where to go next time.', ['帰りの電車で','かえりのでんしゃで'], ['次はどこへ行くか','つぎはどこへいくか'], ['みんなで話しました。','みんなではなしました']),
    ],
  ],
  'n4-library-volunteer': [
    [
      line('The library manager explains the day’s tasks before the doors open.', ['図書館の担当者は','としょかんのたんとうしゃは'], ['開館する前に','かいかんするまえに'], ['その日の仕事を説明します。','そのひのしごとをせつめいします']),
      line('Some volunteers arrange books while others prepare the children’s room.', ['本を並べる人もいれば','ほんをならべるひともいれば'], ['子どもの部屋を','こどものへやを'], ['準備する人もいます。','じゅんびするひともいます']),
    ],
    [
      line('I check the returned books and look for their correct shelf numbers.', ['返された本を調べて','かえされたほんをしらべて'], ['正しい棚の番号を','ただしいたなのばんごうを'], ['探します。','さがします']),
      line('If a book is damaged, I tell the manager before putting it away.', ['本が壊れていたら','ほんがこわれていたら'], ['棚に戻す前に','たなにもどすまえに'], ['担当者に知らせます。','たんとうしゃにしらせます']),
    ],
    [
      line('A family arrives with two young children who want to read together.', ['小さな子どもが二人いる','ちいさなこどもがふたりいる'], ['家族が来て','かぞくがきて'], ['一緒に本を読みたいと言いました。','いっしょにほんをよみたいといいました']),
      line('I show them picture books and help them choose a story.', ['絵本を見せて','えほんをみせて'], ['好きな話を','すきなはなしを'], ['選ぶのを手伝いました。','えらぶのをてつだいました']),
    ],
    [
      line('The children asked what a few difficult words meant.', ['子どもたちは','こどもたちは'], ['難しい言葉の意味を','むずかしいことばのいみを'], ['いくつか質問しました。','いくつかしつもんしました']),
      line('I explained them with simple examples from everyday life.', ['毎日の生活の','まいにちのせいかつの'], ['簡単な例を使って','かんたんなれいをつかって'], ['説明しました。','せつめいしました']),
    ],
    [
      line('At the end of the day, we counted the books and tidied the room.', ['一日の終わりに','いちにちのおわりに'], ['本の数を数えて','ほんのかずをかぞえて'], ['部屋を片付けました。','へやをかたづけました']),
      line('Volunteering takes time, but I enjoy helping people discover books.', ['ボランティアには','ぼらんてぃあには'], ['時間がかかりますが','じかんがかかりますが'], ['本を紹介するのが好きです。','ほんをしょうかいするのがすきです']),
    ],
  ],
};

for (const passage of readingPassages) {
  const expansion = passageExpansions[passage.id];
  if (expansion) passage.paragraphs.push(...expansion);
}

const kanaMap: Record<string, string> = {
  あ:'a',い:'i',う:'u',え:'e',お:'o',か:'ka',き:'ki',く:'ku',け:'ke',こ:'ko',
  さ:'sa',し:'shi',す:'su',せ:'se',そ:'so',た:'ta',ち:'chi',つ:'tsu',て:'te',と:'to',
  な:'na',に:'ni',ぬ:'nu',ね:'ne',の:'no',は:'ha',ひ:'hi',ふ:'fu',へ:'he',ほ:'ho',
  ま:'ma',み:'mi',む:'mu',め:'me',も:'mo',や:'ya',ゆ:'yu',よ:'yo',ら:'ra',り:'ri',る:'ru',れ:'re',ろ:'ro',
  わ:'wa',を:'wo',ん:'n',が:'ga',ぎ:'gi',ぐ:'gu',げ:'ge',ご:'go',ざ:'za',じ:'ji',ず:'zu',ぜ:'ze',ぞ:'zo',
  だ:'da',ぢ:'ji',づ:'zu',で:'de',ど:'do',ば:'ba',び:'bi',ぶ:'bu',べ:'be',ぼ:'bo',ぱ:'pa',ぴ:'pi',ぷ:'pu',ぺ:'pe',ぽ:'po',
  ゔ:'vu',ぁ:'a',ぃ:'i',ぅ:'u',ぇ:'e',ぉ:'o',
};

const digraphMap: Record<string, string> = {
  きゃ:'kya',きゅ:'kyu',きょ:'kyo',しゃ:'sha',しゅ:'shu',しょ:'sho',ちゃ:'cha',ちゅ:'chu',ちょ:'cho',
  にゃ:'nya',にゅ:'nyu',にょ:'nyo',ひゃ:'hya',ひゅ:'hyu',ひょ:'hyo',みゃ:'mya',みゅ:'myu',みょ:'myo',
  りゃ:'rya',りゅ:'ryu',りょ:'ryo',ぎゃ:'gya',ぎゅ:'gyu',ぎょ:'gyo',じゃ:'ja',じゅ:'ju',じょ:'jo',
  びゃ:'bya',びゅ:'byu',びょ:'byo',ぴゃ:'pya',ぴゅ:'pyu',ぴょ:'pyo',てぃ:'ti',でぃ:'di',ふぁ:'fa',ふぃ:'fi',ふぇ:'fe',ふぉ:'fo',
};

function toHiragana(value: string): string {
  return Array.from(value).map((char) => {
    const code = char.charCodeAt(0);
    return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
  }).join('');
}

export function kanaToRomaji(value: string): string {
  const chars = Array.from(toHiragana(value));
  let result = '';
  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char === 'っ') {
      const next = chars[index + 1] || '';
      const pair = digraphMap[char + next] || digraphMap[next + (chars[index + 2] || '')];
      const nextRomaji = pair || kanaMap[next] || '';
      const firstConsonant = nextRomaji[0] || '';
      if (firstConsonant && !'aeioun'.includes(firstConsonant)) result += firstConsonant;
      continue;
    }
    if (char === 'ー') {
      const lastVowel = result.match(/[aeiou]$/)?.[0];
      if (lastVowel) result = result.slice(0, -1) + ({a:'ā',i:'ī',u:'ū',e:'ē',o:'ō'}[lastVowel] || lastVowel);
      continue;
    }
    const pair = char + (chars[index + 1] || '');
    if (digraphMap[pair]) {
      result += digraphMap[pair];
      index += 1;
      continue;
    }
    if (char === 'ん') {
      const next = chars[index + 1] || '';
      const nextRomaji = kanaMap[next] || digraphMap[next + (chars[index + 2] || '')] || '';
      result += /^[aeiouy]/.test(nextRomaji) ? "n'" : 'n';
      continue;
    }
    result += kanaMap[char] || '';
  }
  return result
    .replace(/aa/g, 'ā').replace(/ii/g, 'ī').replace(/uu/g, 'ū')
    .replace(/ee/g, 'ē').replace(/ou/g, 'ō').replace(/oo/g, 'ō');
}

export function getPassageText(passage: ReadingPassage): string {
  return passage.paragraphs.flatMap((paragraph) =>
    paragraph.map((sentence) => sentence.tokens.map((token) => token.text).join('')),
  ).join('');
}

export function estimateReadingMinutes(passage: ReadingPassage): number {
  const characters = Array.from(getPassageText(passage)).length;
  const charactersPerMinute = passage.level === 'N5' ? 70 : 85;
  return Math.max(1, Math.ceil(characters / charactersPerMinute + 0.5));
}

export function getPassagesForLevel(level: ReadingLevel): ReadingPassage[] {
  return readingPassages.filter((passage) => passage.level === level);
}

export function getReadingPassageById(id: string, level: ReadingLevel): ReadingPassage | undefined {
  return readingPassages.find((passage) => passage.id === id && passage.level === level);
}
