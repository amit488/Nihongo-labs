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
  const charactersPerMinute = passage.level === 'N5' ? 90 : 125;
  return Math.max(1, Math.ceil(characters / charactersPerMinute + 0.5));
}

export function getPassagesForLevel(level: ReadingLevel): ReadingPassage[] {
  return readingPassages.filter((passage) => passage.level === level);
}

export function getReadingPassageById(id: string, level: ReadingLevel): ReadingPassage | undefined {
  return readingPassages.find((passage) => passage.id === id && passage.level === level);
}
