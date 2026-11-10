export type SentenceConstructionLevel = 'N5' | 'N4';

export type SentenceConstructionItem = {
  id: string;
  level: SentenceConstructionLevel;
  sentence: string;
  romaji: string;
  meaning: string;
  grammarTags: string[];
  tip: string;
  tokens: string[];
};

function parseRows(level: SentenceConstructionLevel, source: string): SentenceConstructionItem[] {
  return source.trim().split('\n').filter(Boolean).map((line) => {
    const [id, romaji, meaning, rawTags, tip, rawTokens] = line.split('|');
    const tokens = rawTokens.trim().split(/\s+/);
    return {
      id,
      level,
      sentence: tokens.join(''),
      romaji,
      meaning,
      grammarTags: rawTags.split(','),
      tip,
      tokens,
    };
  });
}

const n5Rows = `
n5-001|watashi wa gakusei desu|I am a student.|grammar:copula,particle:wa|は marks the topic; です makes the statement polite.|私 は 学生 です 。
n5-002|Tanaka-san wa sensei desu|Mr. Tanaka is a teacher.|grammar:copula,particle:wa|Use は to introduce the person you are talking about.|田中さん は 先生 です 。
n5-003|kore wa watashi no hon desu|This is my book.|particle:wa,particle:no|の connects two nouns and often shows possession.|これ は 私 の 本 です 。
n5-004|ano hito wa dare desu ka|Who is that person?|particle:wa,grammar:question|誰 asks who; か marks a polite question.|あの 人 は 誰 です か 。
n5-005|watashi mo nihongo o benkyou shimasu|I also study Japanese.|particle:mo,particle:wo|も replaces は when you mean also or too.|私 も 日本語 を 勉強します 。
n5-006|maiasa rokuji ni okimasu|I get up at six every morning.|particle:ni,grammar:time|に marks a specific clock time.|毎朝 六時 に 起きます 。
n5-007|shichiji kara hachiji made benkyou shimasu|I study from seven until eight.|grammar:kara-made|から marks the start and まで marks the end.|七時 から 八時 まで 勉強します 。
n5-008|gakkou e aruite ikimasu|I walk to school.|particle:he-vs-ni,grammar:movement|へ marks the direction of movement.|学校 へ 歩いて 行きます 。
n5-009|toshokan de hon o yomimasu|I read a book at the library.|particle:ni-vs-de,particle:wo|で marks where an action takes place.|図書館 で 本 を 読みます 。
n5-010|mizu o ippai nomimasu|I drink one glass of water.|particle:wo,grammar:counters|を marks the thing being drunk; 一杯 counts cups or glasses.|水 を 一杯 飲みます 。
n5-011|tomodachi to eiga o mimasu|I watch a movie with a friend.|particle:to,particle:wo|と marks a companion when it means with.|友達 と 映画 を 見ます 。
n5-012|haha ni denwa o shimasu|I call my mother.|particle:ni,particle:wo|に can mark the person receiving a phone call.|母 に 電話 を します 。
n5-013|eki no mae ni mise ga arimasu|There is a shop in front of the station.|particle:no,grammar:existence|あります is used for things and places that are not alive.|駅 の 前 に 店 が あります 。
n5-014|heya ni neko ga imasu|There is a cat in the room.|particle:ni-vs-de,grammar:existence|います is used for people and animals that are alive.|部屋 に 猫 が います 。
n5-015|tsukue no ue ni hon ga arimasu|There is a book on the desk.|particle:no,grammar:existence|の links the desk and its top; に marks the location.|机 の 上 に 本 が あります 。
n5-016|kouen ni kodomo ga imasu|There are children in the park.|particle:ni-vs-de,grammar:existence|Use います for people and animals.|公園 に 子供 が います 。
n5-017|kinou suupaa e ikimashita|I went to the supermarket yesterday.|verb:past,particle:he-vs-ni|ました is the polite past form of a verb.|昨日 スーパー へ 行きました 。
n5-018|senshuu wa hatarakimasen deshita|I did not work last week.|verb:negative,verb:past|ませんでした forms the polite past negative.|先週 は 働きませんでした 。
n5-019|ashita wa gakkou e ikimasen|I will not go to school tomorrow.|verb:negative,particle:he-vs-ni|ません is the polite negative; context can refer to the future.|明日 は 学校 へ 行きません 。
n5-020|nichiyoubi ni nani o shimasu ka|What will you do on Sunday?|grammar:question,particle:ni,particle:wo|何 asks what; に marks the day.|日曜日 に 何 を します か 。
n5-021|doko de hirugohan o tabemasu ka|Where will you eat lunch?|grammar:question,particle:ni-vs-de,particle:wo|で asks for the place where an action happens.|どこ で 昼ご飯 を 食べます か 。
n5-022|nanji ni kaerimasu ka|What time will you return?|grammar:question,particle:ni,grammar:time|何時 asks what time; に marks the specific time.|何時 に 帰ります か 。
n5-023|watashi wa amari terebi o mimasen|I do not watch much television.|grammar:frequency,verb:negative|あまり is commonly used with a negative verb to mean not much.|私 は あまり テレビ を 見ません 。
n5-024|mainichi sukoshi undou shimasu|I exercise a little every day.|grammar:frequency|毎日 gives the frequency and 少し means a little.|毎日 少し 運動します 。
n5-025|kyou wa atsui desu|It is hot today.|adjective:i,particle:wa|い-adjectives can directly describe the subject before です.|今日 は 暑い です 。
n5-026|kono mise no ryouri wa oishii desu|The food at this shop is delicious.|adjective:i,particle:no,particle:wa|この points to a nearby noun; おいしい is an い-adjective.|この 店 の 料理 は おいしい です 。
n5-027|kinou no eiga wa omoshirokatta desu|Yesterday's movie was interesting.|adjective:past,particle:no|An い-adjective changes い to かった for the past.|昨日 の 映画 は 面白かった です 。
n5-028|kono heya wa hiroku arimasen|This room is not spacious.|adjective:negative,particle:wa|The negative of an い-adjective uses くありません.|この 部屋 は 広く ありません 。
n5-029|atarashii fuku o kaimashita|I bought new clothes.|adjective:i,verb:past|An い-adjective can come directly before a noun.|新しい 服 を 買いました 。
n5-030|shizuka na machi ni sunde imasu|I live in a quiet town.|adjective:na,particle:ni|な links a な-adjective to a noun.|静かな 町 に 住んでいます 。
n5-031|kare wa shinsetsu na hito desu|He is a kind person.|adjective:na,particle:wa|A な-adjective uses な before a noun.|彼 は 親切な 人 です 。
n5-032|kirei na hana desu ne|It is a beautiful flower, isn't it?|adjective:na,grammar:confirmation|きれい is a な-adjective despite ending in い.|きれいな 花 です ね 。
n5-033|asagohan o tabete gakkou e ikimasu|I eat breakfast and then go to school.|verb:te-form,grammar:sequence|The て-form connects actions in sequence.|朝ご飯 を 食べて 学校 へ 行きます 。
n5-034|doa o akete kudasai|Please open the door.|verb:te-form,grammar:request,particle:wo|てください makes a polite request.|ドア を 開けて ください 。
n5-035|koko de shashin o totte mo ii desu ka|May I take a picture here?|verb:te-form,grammar:permission,particle:ni-vs-de|てもいいですか asks for permission.|ここ で 写真 を 撮って も いい です か 。
n5-036|kono heya de tabako o sutte wa ikemasen|You must not smoke in this room.|verb:te-form,grammar:prohibition,particle:ni-vs-de|てはいけません expresses prohibition.|この 部屋 で タバコ を 吸って は いけません 。
n5-037|mainichi pan o tabemasu|I eat bread every day.|particle:wo,grammar:frequency|を marks the direct object of 食べます.|毎日 パン を 食べます 。
n5-038|nihongo wa muzukashii desu ga omoshiroi desu|Japanese is difficult, but interesting.|particle:wa,grammar:contrast|が can connect two ideas with a meaning like but.|日本語 は 難しい です が 面白い です 。
n5-039|ame ga futte imasu|It is raining.|verb:te-iru,particle:ga|ています describes an action or state in progress.|雨 が 降っています 。
n5-040|ima tegami o kaite imasu|I am writing a letter now.|verb:te-iru,particle:wo|The て-form plus います describes an ongoing action.|今 手紙 を 書いています 。
n5-041|shuumatsu wa ie de yasumitai desu|I want to rest at home on the weekend.|grammar:desire,particle:de|たい expresses the speaker's desire to do something.|週末 は 家 で 休みたい です 。
n5-042|hirugohan o tabemashou|Let's eat lunch.|grammar:invitation,particle:wo|ましょう is a polite suggestion meaning let's.|昼ご飯 を 食べましょう 。
n5-043|eki de tomodachi ni aimasu|I meet a friend at the station.|particle:ni-vs-de,particle:ni|で marks the meeting place; に marks the person met.|駅 で 友達 に 会います 。
n5-044|mou shukudai o shimashita|I have already done my homework.|grammar:mou,verb:past|もう means already when used with a completed action.|もう 宿題 を しました 。
n5-045|mada asagohan o tabete imasen|I have not eaten breakfast yet.|grammar:mada,verb:negative,verb:te-form|まだ plus a negative means not yet.|まだ 朝ご飯 を 食べていません 。
n5-046|ani wa watashi yori se ga takai desu|My older brother is taller than me.|grammar:comparison,particle:ga|より marks the comparison baseline.|兄 は 私 より 背 が 高い です 。
n5-047|kono hon wa ano hon yori yasui desu|This book is cheaper than that book.|grammar:comparison,adjective:i|より introduces the thing used for comparison.|この 本 は あの 本 より 安い です 。
n5-048|ringo o mittsu kudasai|Please give me three apples.|grammar:counters,particle:wo,grammar:request|三つ is the general counter for three items.|りんご を 三つ ください 。
n5-049|mainichi kanji o itsutsu oboemasu|I memorise five kanji every day.|grammar:counters,particle:wo,grammar:frequency|五つ counts five general items.|毎日 漢字 を 五つ 覚えます 。
n5-050|koko kara eki made juppun desu|It is ten minutes from here to the station.|grammar:kara-made,grammar:duration|から and まで show the start and end points.|ここ から 駅 まで 十分 です 。
n5-051|nihon e ikitai desu|I want to go to Japan.|grammar:desire,particle:he-vs-ni|たい attaches to the verb stem to express desire.|日本 へ 行きたい です 。
n5-052|watashi wa nihongo o hanasu koto ga dekimasu|I can speak Japanese.|grammar:ability,nominalization,particle:wo|ことができます expresses ability to do an action.|私 は 日本語 を 話す こと が できます 。
n5-053|watashi no shumi wa hon o yomu koto desu|My hobby is reading books.|grammar:nominalization,particle:no,particle:wa|こと turns a verb phrase into a noun-like activity.|私 の 趣味 は 本 を 読む こと です 。
n5-054|shuumatsu ni tomodachi to asobimasu|I spend time with friends on the weekend.|particle:ni,particle:to,grammar:frequency|に marks the time; と marks the companion.|週末 に 友達 と 遊びます 。
n5-055|dochira no ryouri ga suki desu ka|Which dish do you like?|grammar:question,particle:no,particle:ga|どちら asks which of two or more choices.|どちら の 料理 が 好き です か 。
n5-056|inu to neko to dochira ga suki desu ka|Which do you like, dogs or cats?|grammar:comparison,grammar:question,particle:to|と lists the choices being compared.|犬 と 猫 と どちら が 好き です か 。
n5-057|kyou wa ame desu kara ie ni imasu|It is raining today, so I am staying home.|grammar:reason,particle:kara,grammar:existence|から gives a reason; います describes staying or being somewhere.|今日は 雨 です から 家 に います 。
n5-058|basu de kaisha e ikimasu|I go to work by bus.|particle:de,particle:he-vs-ni|で marks the means of transport.|バス で 会社 へ 行きます 。
n5-059|watashi wa koohii ga suki desu|I like coffee.|particle:wa,particle:ga,grammar:likes|好き uses が for the thing liked.|私 は コーヒー が 好き です 。
n5-060|dareka kyoushitsu ni imasu ka|Is someone in the classroom?|grammar:indefinite-pronoun,grammar:existence|誰か means someone when used in a question.|誰か 教室 に います か 。
n5-061|nani mo kaimasen deshita|I did not buy anything.|grammar:negative-pronoun,verb:negative,verb:past|何も with a negative verb means nothing or not anything.|何も 買いませんでした 。
n5-062|mada jikan ga arimasu|There is still time.|grammar:mada,grammar:existence,particle:ga|まだ can mean still when something remains.|まだ 時間 が あります 。
n5-063|kyou wa hayaku kaerimasu|I will go home early today.|grammar:adverb,particle:wa|早く is the adverb form of the い-adjective 早い.|今日は 早く 帰ります 。
n5-064|ame ga furimashita kara dekakemasen deshita|It rained, so I did not go out.|grammar:reason,verb:past,verb:negative|から connects the reason to the result.|雨 が 降りました から 出かけませんでした 。
n5-065|uchi de nihongo o benkyou shite kara nemasu|I study Japanese at home and then go to bed.|verb:te-form,grammar:sequence,particle:de|てから shows that the second action happens after the first.|うち で 日本語 を 勉強してから 寝ます 。
n5-066|te o aratte kara gohan o tabemasu|I wash my hands before eating.|verb:te-form,grammar:sequence,particle:wo|てから marks the order of two actions.|手 を 洗ってから ご飯 を 食べます 。
n5-067|ryokou ni ikimasen ka|Would you like to go on a trip?|grammar:invitation,verb:negative,particle:ni|ませんか is a polite way to invite someone.|旅行 に 行きません か 。
n5-068|issho ni hirugohan o tabemashou|Let's have lunch together.|grammar:invitation,particle:ni|一緒に means together; ましょう makes a suggestion.|一緒 に 昼ご飯 を 食べましょう 。
n5-069|sensei wa kyoushitsu ni imasu|The teacher is in the classroom.|particle:wa,particle:ni,grammar:existence|います is used for people and animals.|先生 は 教室 に います 。
n5-070|heya ni terebi ga arimasu|There is a television in the room.|particle:ni,particle:ga,grammar:existence|あります is used for objects.|部屋 に テレビ が あります 。
n5-071|donna ongaku o kikimasu ka|What kind of music do you listen to?|grammar:question,particle:wo|どんな asks what kind of something.|どんな 音楽 を 聞きます か 。
n5-072|ano mise de yasui kutsu o kaimashita|I bought inexpensive shoes at that shop.|particle:de,particle:wo,verb:past|で marks the place where the purchase happened.|あの 店 で 安い 靴 を 買いました 。
n5-073|kono kanji o yonde kudasai|Please read this kanji.|verb:te-form,grammar:request,particle:wo|てください makes a polite request.|この 漢字 を 読んで ください 。
n5-074|kyou wa isogashiku nai desu|I am not busy today.|adjective:negative,particle:wa|The negative of 忙しい is 忙しくない.|今日は 忙しくない です 。
n5-075|nihongo no hon o nisatsu kaimashita|I bought two Japanese books.|particle:no,particle:wo,grammar:counters,verb:past|冊 counts bound volumes such as books.|日本語 の 本 を 二冊 買いました 。
n5-076|gakkou made aruite juugofun kakarimasu|It takes fifteen minutes to walk to school.|grammar:duration,grammar:kara-made|まで marks the destination; かかります expresses required time.|学校 まで 歩いて 十五分 かかります 。
n5-077|watashi wa maiban ofuro ni hairimasu|I take a bath every evening.|particle:wa,particle:ni,grammar:frequency|毎晩 gives the frequency; に marks the bath activity.|私 は 毎晩 お風呂 に 入ります 。
n5-078|tomodachi wa mada kite imasen|My friend has not arrived yet.|grammar:mada,verb:te-iru,verb:negative|まだ来ていません means has not come yet.|友達 は まだ 来ていません 。
n5-079|kono kasa wa dare no desu ka|Whose umbrella is this?|particle:wa,particle:no,grammar:question|誰の asks whose; の can stand in place of a noun.|この 傘 は 誰 の です か 。
n5-080|watashi wa mainichi densha de kaisha ni ikimasu|I go to the office by train every day.|particle:wa,particle:de,particle:ni,grammar:frequency|で marks transport and に marks the destination.|私 は 毎日 電車 で 会社 に 行きます 。
`;

const n4Rows = `
n4-001|maiasa jogingu o suru you ni shite imasu|I make a point of jogging every morning.|grammar:habit,grammar:you-ni|ようにしています describes a habit or deliberate effort.|毎朝 ジョギング を する ように しています 。
n4-002|wasurenai you ni memo o torimasu|I take notes so that I do not forget.|grammar:purpose,grammar:you-ni,verb:negative|ないように expresses taking care not to do something.|忘れない ように メモ を 取ります 。
n4-003|nihon ni iku tame ni okane o tamete imasu|I am saving money in order to go to Japan.|grammar:purpose,grammar:tame-ni|ために states the purpose of an intentional action.|日本 に 行く ために お金 を 貯めています 。
n4-004|eki ni tsuitara denwa shite kudasai|Please call me when you arrive at the station.|grammar:conditional,grammar:tara,verb:te-form|たら can mean when or after a condition is met.|駅 に 着いたら 電話して ください 。
n4-005|jikan ga areba eiga o mimasu|If I have time, I will watch a movie.|grammar:conditional,grammar:ba|The ば-form expresses a condition.|時間 が あれば 映画 を 見ます 。
n4-006|ame nara shiai wa chuushi desu|If it rains, the game will be cancelled.|grammar:conditional,grammar:nara|なら introduces a condition based on the situation or topic.|雨 なら 試合 は 中止 です 。
n4-007|isogashii node kyou wa hayaku kaerimasu|Because I am busy, I will go home early today.|grammar:reason,grammar:node|ので gives a reason and often sounds softer than から.|忙しい ので 今日 は 早く 帰ります 。
n4-008|netsu ga aru kara gakkou o yasumimasu|I will miss school because I have a fever.|grammar:reason,particle:kara|から gives a direct reason for the decision.|熱 が ある から 学校 を 休みます 。
n4-009|nihongo ga hanaseru you ni narimashita|I have become able to speak Japanese.|grammar:potential,grammar:change,grammar:you-ni|ようになる describes a change in ability or state.|日本語 が 話せる ように なりました 。
n4-010|kono kanji wa yomemasu|I can read this kanji.|grammar:potential,particle:wa|読めます is the potential form of 読みます.|この 漢字 は 読めます 。
n4-011|kinou saifu o otoshite shimaimashita|I accidentally dropped my wallet yesterday.|grammar:result,grammar:teshimau,verb:past|てしまう can express an unintended or regrettable result.|昨日 財布 を 落として しまいました 。
n4-012|ryokou no mae ni hoteru o yoyaku shite okimasu|I will book the hotel in advance before the trip.|grammar:preparation,grammar:teoku,particle:no|ておく describes doing something ahead of time.|旅行 の 前 に ホテル を 予約して おきます 。
n4-013|mado ga akete arimasu|The window has been left open.|grammar:state-result,grammar:tearu|てある describes a resulting state caused by an action.|窓 が 開けて あります 。
n4-014|ryouri o tsukurinagara ongaku o kikimasu|I listen to music while cooking.|grammar:simultaneous,grammar:nagara|ながら connects two actions done at the same time.|料理 を 作りながら 音楽 を 聞きます 。
n4-015|ongaku o kiku no ga suki desu|I like listening to music.|grammar:nominalization,grammar:noga|の makes the verb phrase noun-like; が marks what is liked.|音楽 を 聞く の が 好き です 。
n4-016|nihon e itta koto ga arimasu|I have been to Japan.|grammar:experience,grammar:ta-koto-ga-aru|たことがあります describes a past experience.|日本 へ 行った こと が あります 。
n4-017|fujisan ni nobotta koto ga arimasen|I have never climbed Mount Fuji.|grammar:experience,verb:negative|ません makes the experience statement negative.|富士山 に 登った こと が ありません 。
n4-018|mainichi nijikan benkyou suru tsumori desu|I intend to study for two hours every day.|grammar:intention,grammar:tsumori|つもりです expresses the speaker's intention.|毎日 二時間 勉強する つもり です 。
n4-019|raigetsu hikkosu yotei desu|I am scheduled to move next month.|grammar:schedule,grammar:yotei|予定です describes a plan or schedule.|来月 引っ越す 予定 です 。
n4-020|mou sugu ame ga furi sou desu|It looks like it will rain soon.|grammar:appearance,grammar:sou|そうです after a verb stem expresses appearance.|もうすぐ 雨 が 降り そう です 。
n4-021|kono ryouri wa oishi sou desu|This dish looks delicious.|grammar:appearance,grammar:sou,adjective:i|そうです after an adjective stem describes how something looks.|この 料理 は おいし そう です 。
n4-022|Tanaka-san wa kuru rashii desu|Apparently, Mr. Tanaka is coming.|grammar:hearsay,grammar:rashii|らしいです can report information heard from another source.|田中さん は 来る らしい です 。
n4-023|kare wa gakusei no you desu|He seems to be a student.|grammar:inference,grammar:you-desu|ようです expresses an impression or inference based on evidence.|彼 は 学生 の よう です 。
n4-024|kyou wa haru mitai desu|Today feels like spring.|grammar:comparison,grammar:mitai|みたいです is a conversational expression meaning seems like.|今日は 春 みたい です 。
n4-025|kono hon wa kodomo demo yomemasu|Even children can read this book.|grammar:concession,grammar:demo|でも can mean even when it follows a noun.|この 本 は 子供 でも 読めます 。
n4-026|nihongo shika hanasemasen|I can speak only Japanese.|grammar:only,grammar:shika,verb:negative|しか is used with a negative form to mean only.|日本語 しか 話せません 。
n4-027|kyou wa koohii dake nomimashita|I drank only coffee today.|grammar:only,grammar:dake,verb:past|だけ means only and does not require a negative verb.|今日は コーヒー だけ 飲みました 。
n4-028|isogashikutemo mainichi benkyou shimasu|Even when I am busy, I study every day.|grammar:concession,grammar:temo|ても expresses even if or even though.|忙しくても 毎日 勉強します 。
n4-029|shigoto ga owatta bakari desu|I have just finished work.|grammar:recent-completion,grammar:bakari|たばかり means something has just happened.|仕事 が 終わった ばかり です 。
n4-030|nihongo o benkyou shi hajimemashita|I started studying Japanese.|grammar:beginning,grammar:hajimeru,verb:past|始める after a verb stem means to start doing something.|日本語 を 勉強し 始めました 。
n4-031|sannenkan nihongo o benkyou shi tsuzukete imasu|I have continued studying Japanese for three years.|grammar:continuation,grammar:tsuzukeru|続ける after a verb stem means to continue doing it.|三年間 日本語 を 勉強し 続けています 。
n4-032|kanji o oboeru no ni jikan ga kakarimasu|It takes time to memorise kanji.|grammar:purpose,grammar:noni,nominalization|のに can mean for doing something when followed by a requirement or difficulty.|漢字 を 覚える のに 時間 が かかります 。
n4-033|shiken ni goukaku suru tame ni renshuu shite imasu|I am practising in order to pass the exam.|grammar:purpose,grammar:tame-ni|ために explains the goal of the practice.|試験 に 合格する ために 練習して います 。
n4-034|tomodachi ni purezento o agemashita|I gave a present to my friend.|grammar:giving-receiving,particle:ni,verb:past|あげる describes giving something to another person.|友達 に プレゼント を あげました 。
n4-035|sensei ga hon o kudasaimashita|The teacher gave me a book.|grammar:giving-receiving,particle:ga,verb:past|くださる is the respectful form used when someone gives to you or your group.|先生 が 本 を くださいました 。
n4-036|tomodachi ni eki made okutte moraimashita|A friend kindly took me to the station.|grammar:giving-receiving,grammar:morau,verb:past|てもらう describes receiving a favour from someone.|友達 に 駅 まで 送って もらいました 。
n4-037|haha ni ryouri o tsukutte agemashita|I cooked a meal for my mother.|grammar:giving-receiving,verb:te-form,verb:past|てあげる means doing something for someone.|母 に 料理 を 作って あげました 。
n4-038|ame ni furarete fuku ga nuremashita|I was caught in the rain and my clothes got wet.|grammar:passive,verb:te-form|The passive 降られる can describe being adversely affected by rain.|雨 に 降られて 服 が ぬれました 。
n4-039|kono uta wa sekaijuu de utawarete imasu|This song is sung all over the world.|grammar:passive,verb:te-iru|歌われています is the passive form describing an ongoing state.|この 歌 は 世界中 で 歌われています 。
n4-040|sensei ni homeraremashita|I was praised by the teacher.|grammar:passive,verb:past,particle:ni|に can mark the person performing the passive action.|先生 に ほめられました 。
n4-041|otouto ni keeki o taberaremashita|My younger brother ate my cake, to my annoyance.|grammar:passive,verb:past|The affected passive can show that an action caused trouble for the speaker.|弟 に ケーキ を 食べられました 。
n4-042|kodomo ni yasai o tabesasemasu|I make the child eat vegetables.|grammar:causative,verb:negative|食べさせます is the causative form of 食べます.|子供 に 野菜 を 食べさせます 。
n4-043|haha wa watashi ni heya o souji sasemashita|My mother made me clean the room.|grammar:causative,verb:past|させる expresses making or letting someone do an action.|母 は 私 に 部屋 を 掃除させました 。
n4-044|kono kusuri o nomanakereba narimasen|I have to take this medicine.|grammar:obligation,grammar:nakereba|なければなりません expresses obligation.|この 薬 を 飲まなければ なりません 。
n4-045|kyou wa gakkou e ikanakutemo ii desu|You do not have to go to school today.|grammar:no-need,grammar:temo-ii|なくてもいい means that something is not necessary.|今日は 学校 へ 行かなくても いい です 。
n4-046|watashi wa nihongo o benkyou suru koto ni shimashita|I decided to study Japanese.|grammar:decision,grammar:koto-ni-suru|ことにする describes a decision made by the speaker.|私は 日本語 を 勉強する ことに しました 。
n4-047|mainichi hashiru koto ni shite imasu|I make it a rule to run every day.|grammar:habit,grammar:koto-ni-shiteiru|ことにしている describes a personal rule or regular habit.|毎日 走る ことに しています 。
n4-048|kare wa hayaku kaeru koto ni narimashita|It has been decided that he will return early.|grammar:decision,grammar:koto-ni-naru|ことになる describes a decision or arrangement made outside the speaker.|彼 は 早く 帰る ことに なりました 。
n4-049|raishuu kara atarashii shigoto o hajimeru koto ni narimasu|I will be starting a new job next week.|grammar:decision,grammar:koto-ni-naru|ことになる expresses an arrangement or decision.|来週 から 新しい 仕事 を 始める ことに なります 。
n4-050|kyou wa kinou hodo samukunai desu|Today is not as cold as yesterday.|grammar:comparison,adjective:negative|ほど in a negative comparison means not as much as.|今日は 昨日 ほど 寒くない です 。
n4-051|nihongo wa eigo yori muzukashii to omoimasu|I think Japanese is more difficult than English.|grammar:opinion,grammar:to-omou|と思います introduces the speaker's opinion.|日本語 は 英語 より 難しい と 思います 。
n4-052|kare wa ashita kuru to itte imashita|He said that he would come tomorrow.|grammar:quotation,grammar:to-iu,verb:past|と言っていました reports what someone said.|彼 は 明日 来る と 言っていました 。
n4-053|wasurenaide kudasai|Please do not forget.|grammar:negative-request,verb:negative|ないでください asks someone not to do something.|忘れないで ください 。
n4-054|mou sukoshi yukkuri hanashite itadakemasen ka|Could you speak a little more slowly?|grammar:polite-request,grammar:te-itadaku|ていただけませんか is a polite request.|もう 少し ゆっくり 話して いただけません か 。
n4-055|koko de matte ite mo ii desu ka|May I wait here?|grammar:permission,grammar:te-iru|ていてもいい asks whether continuing to stay or wait is permitted.|ここ で 待っていて も いい です か 。
n4-056|eki ni tsuku made matte kudasai|Please wait until we reach the station.|grammar:limit,grammar:made|まで marks the endpoint in time or space.|駅 に 着く まで 待って ください 。
n4-057|densha ni noru mae ni kippu o kaimasu|I buy a ticket before getting on the train.|grammar:time-order,grammar:mae-ni|辞書-form verb plus 前に means before doing something.|電車 に 乗る 前 に 切符 を 買います 。
n4-058|gohan o tabeta ato de sanpo shimasu|I take a walk after eating.|grammar:time-order,grammar:ato-de|たあとで means after completing an action.|ご飯 を 食べた 後で 散歩します 。
n4-059|kodomo no toki yoku kawa de oyogimashita|When I was a child, I often swam in the river.|grammar:time-expression,grammar:toki|のとき gives the time or stage of life when something happened.|子供 の とき よく 川 で 泳ぎました 。
n4-060|nihon e iku toki pasupooto ga hitsuyou desu|A passport is necessary when going to Japan.|grammar:time-expression,grammar:toki|辞書-form verb plus とき refers to the time before or during an action.|日本 へ 行く とき パスポート が 必要 です 。
n4-061|ongaku o kiku to genki ni narimasu|When I listen to music, I feel better.|grammar:conditional,grammar:to|と can express a natural or automatic result.|音楽 を 聞く と 元気 に なります 。
n4-062|haru ni naru to sakura ga sakimasu|When spring comes, cherry blossoms bloom.|grammar:conditional,grammar:to|と connects a condition with a predictable result.|春 に なる と 桜 が 咲きます 。
n4-063|ame ga futte mo dekakemasu|Even if it rains, I will go out.|grammar:concession,grammar:temo|ても expresses that the result remains true despite the condition.|雨 が 降って も 出かけます 。
n4-064|hayaku neta hou ga ii desu|You should go to bed early.|grammar:recommendation,grammar:hou-ga-ii|たほうがいい gives advice or a recommendation.|早く 寝た 方 が いい です 。
n4-065|muri o shinai hou ga ii desu|You should not push yourself too hard.|grammar:recommendation,grammar:hou-ga-ii,verb:negative|ないほうがいい advises against an action.|無理 を しない 方 が いい です 。
n4-066|mainichi nihongo o benkyou sureba nihongo ga jouzu ni narimasu|If you study Japanese every day, you will improve.|grammar:conditional,grammar:ba|ば expresses a condition that leads to a result.|毎日 日本語 を 勉強すれば 日本語 が 上手 に なります 。
n4-067|nando yonde mo imi ga wakarimasen|No matter how many times I read it, I cannot understand the meaning.|grammar:concession,grammar:temo|何度〜ても means no matter how many times.|何度 読んで も 意味 が 分かりません 。
n4-068|denki o tsuketa mama nete shimaimashita|I fell asleep with the light left on.|grammar:state,grammar:mama,grammar:teshimau|まま describes leaving something in a state; てしまう can show an unintended result.|電気 を つけた まま 寝て しまいました 。
n4-069|nihon de hataraku tame ni nihongo o manande imasu|I am learning Japanese in order to work in Japan.|grammar:purpose,grammar:tame-ni|ために introduces the purpose of learning.|日本 で 働く ために 日本語 を 学んでいます 。
n4-070|isogashisugite hirugohan o taberaremasen deshita|I was so busy that I could not eat lunch.|grammar:too-much,grammar:sugiru,verb:potential|すぎる means too much; 食べられません expresses inability.|忙しすぎて 昼ご飯 を 食べられませんでした 。
n4-071|kare wa hataraite iru shi benkyou mo shite imasu|He works and studies as well.|grammar:listing-reasons,grammar:shi|し lists reasons or facts that support a point.|彼 は 働いている し 勉強 も しています 。
n4-072|kono ryouri wa karasugimasu|This dish is too spicy.|grammar:too-much,grammar:sugiru|すぎます after an adjective stem means too much.|この 料理 は 辛すぎます 。
n4-073|asa kara ame ga futte imasu|It has been raining since morning.|grammar:duration,grammar:te-iru,particle:kara|から marks the starting point of a continuing situation.|朝 から 雨 が 降っています 。
n4-074|sensei ni soudan shite mimasu|I will try consulting the teacher.|grammar:attempt,grammar:temiru|てみる means to try doing something.|先生 に 相談して みます 。
n4-075|kono mondai o toite mite kudasai|Please try solving this problem.|grammar:attempt,grammar:temiru,verb:te-form|てみてください politely asks someone to try an action.|この 問題 を 解いて みて ください 。
n4-076|kare wa yakusoku o mamoru hazu desu|He is supposed to keep his promise.|grammar:expectation,grammar:hazu|はずです expresses an expectation based on what is known.|彼 は 約束 を 守る はず です 。
n4-077|kyou wa hayaku owaru hazu desu|It should finish early today.|grammar:expectation,grammar:hazu|はずです indicates what the speaker expects to happen.|今日は 早く 終わる はず です 。
n4-078|Tanaka-san wa kaigi ni shusseki suru sou desu|I hear that Mr. Tanaka will attend the meeting.|grammar:hearsay,grammar:sou|そうです after a plain form reports information heard.|田中さん は 会議 に 出席する そう です 。
n4-079|kaze o hiita node kusuri o nomimashita|I caught a cold, so I took medicine.|grammar:reason,grammar:node,verb:past|ので connects a reason to the resulting action.|風邪 を ひいた ので 薬 を 飲みました 。
n4-080|koko ni namae o kaite oite kudasai|Please write your name here in advance.|grammar:preparation,grammar:teoku,verb:request|ておいてください asks someone to do something beforehand.|ここ に 名前 を 書いて おいて ください 。
`;

export const sentenceConstructionBank: SentenceConstructionItem[] = [
  ...parseRows('N5', n5Rows),
  ...parseRows('N4', n4Rows),
];

export function getSentenceConstructionItems(level: SentenceConstructionLevel) {
  return sentenceConstructionBank.filter((item) => item.level === level);
}

export function getSentenceConstructionItem(id: string, level: SentenceConstructionLevel) {
  return sentenceConstructionBank.find((item) => item.id === id && item.level === level) ?? null;
}
