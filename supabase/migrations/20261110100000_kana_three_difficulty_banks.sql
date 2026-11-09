-- Upgrade the one-off Kana quiz into three independent 33-question difficulty banks.
-- This migration preserves the prior easy quiz row and all historical attempts.
begin;

update public.quizzes
set slug = 'kana-easy',
    title = 'Kana Recognition · Easy',
    description = 'Build speed with basic Hiragana and Katakana recognition.',
    time_limit_seconds = 900,
    pass_percentage = 75,
    publication_status = 'published',
    shuffle_questions = true,
    show_results_after_submit = true,
    updated_at = now()
where slug = 'kana-recognition-challenge'
  and not exists (select 1 from public.quizzes where slug = 'kana-easy');

update public.quizzes
set publication_status = 'draft', updated_at = now()
where slug in ('kana-recognition-challenge','n5-kana-practice');

insert into public.quizzes
  (lesson_id, slug, title, description, access_level, publication_status,
   time_limit_seconds, pass_percentage, shuffle_questions, show_results_after_submit, sort_order)
select l.id, cfg.slug, cfg.title, cfg.description, 'free', 'published',
       900, 75, true, true, cfg.sort_order
from public.lessons l
join public.course_units u on u.id = l.unit_id
join public.courses c on c.id = u.course_id
cross join (values
  ('kana-easy','Kana Recognition · Easy','Basic Hiragana and Katakana recognition.',3),
  ('kana-medium','Kana Recognition · Medium','Dakuten, handakuten and combined kana sounds.',4),
  ('kana-hard','Kana Recognition · Hard','Look-alike characters, small kana, long vowels and loanword combinations.',5)
) as cfg(slug,title,description,sort_order)
where c.slug = 'nihongo-n5-foundations' and u.slug = 'kana' and l.slug = 'hiragana'
on conflict (slug) do update set
  lesson_id = excluded.lesson_id,
  title = excluded.title,
  description = excluded.description,
  access_level = excluded.access_level,
  publication_status = 'published',
  time_limit_seconds = excluded.time_limit_seconds,
  pass_percentage = excluded.pass_percentage,
  shuffle_questions = true,
  show_results_after_submit = true,
  sort_order = excluded.sort_order,
  updated_at = now();

create temporary table kana_question_seed (
  difficulty text not null,
  quiz_slug text not null,
  sort_order integer not null,
  prompt jsonb not null,
  answer_key jsonb not null,
  explanation jsonb not null,
  options jsonb not null,
  primary key (difficulty, sort_order)
) on commit drop;

insert into kana_question_seed
  (difficulty, quiz_slug, sort_order, prompt, answer_key, explanation, options)
values
  ('easy', 'kana-easy', 1, '{"text":"あ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"あ is pronounced a.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"a"},{"key":"B","text":"i"},{"key":"C","text":"u"},{"key":"D","text":"e"}]'::jsonb),
  ('easy', 'kana-easy', 2, '{"text":"い","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"い is pronounced i.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"o"},{"key":"B","text":"i"},{"key":"C","text":"ka"},{"key":"D","text":"ki"}]'::jsonb),
  ('easy', 'kana-easy', 3, '{"text":"う","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"う is pronounced u.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ku"},{"key":"B","text":"ke"},{"key":"C","text":"u"},{"key":"D","text":"ko"}]'::jsonb),
  ('easy', 'kana-easy', 4, '{"text":"Which Hiragana character represents “e”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"え is the Hiragana character for e.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ち"},{"key":"B","text":"つ"},{"key":"C","text":"て"},{"key":"D","text":"え"}]'::jsonb),
  ('easy', 'kana-easy', 5, '{"text":"お","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"お is pronounced o.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"o"},{"key":"B","text":"se"},{"key":"C","text":"so"},{"key":"D","text":"ta"}]'::jsonb),
  ('easy', 'kana-easy', 6, '{"text":"か","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"か is pronounced ka.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"chi"},{"key":"B","text":"ka"},{"key":"C","text":"tsu"},{"key":"D","text":"te"}]'::jsonb),
  ('easy', 'kana-easy', 7, '{"text":"き","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"き is pronounced ki.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"to"},{"key":"B","text":"na"},{"key":"C","text":"ki"},{"key":"D","text":"ni"}]'::jsonb),
  ('easy', 'kana-easy', 8, '{"text":"Which Hiragana character represents “sa”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"さ is the Hiragana character for sa.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ゆ"},{"key":"B","text":"よ"},{"key":"C","text":"ら"},{"key":"D","text":"さ"}]'::jsonb),
  ('easy', 'kana-easy', 9, '{"text":"し","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"し is pronounced shi.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"shi"},{"key":"B","text":"ha"},{"key":"C","text":"hi"},{"key":"D","text":"fu"}]'::jsonb),
  ('easy', 'kana-easy', 10, '{"text":"た","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"た is pronounced ta.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"he"},{"key":"B","text":"ta"},{"key":"C","text":"ho"},{"key":"D","text":"ma"}]'::jsonb),
  ('easy', 'kana-easy', 11, '{"text":"な","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"な is pronounced na.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"mi"},{"key":"B","text":"mu"},{"key":"C","text":"na"},{"key":"D","text":"me"}]'::jsonb),
  ('easy', 'kana-easy', 12, '{"text":"Which Hiragana character represents “ni”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"に is the Hiragana character for ni.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"つ"},{"key":"B","text":"て"},{"key":"C","text":"と"},{"key":"D","text":"に"}]'::jsonb),
  ('easy', 'kana-easy', 13, '{"text":"は","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"は is pronounced ha.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ha"},{"key":"B","text":"a"},{"key":"C","text":"i"},{"key":"D","text":"u"}]'::jsonb),
  ('easy', 'kana-easy', 14, '{"text":"ま","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ま is pronounced ma.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"e"},{"key":"B","text":"ma"},{"key":"C","text":"o"},{"key":"D","text":"ka"}]'::jsonb),
  ('easy', 'kana-easy', 15, '{"text":"や","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"や is pronounced ya.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ki"},{"key":"B","text":"ku"},{"key":"C","text":"ya"},{"key":"D","text":"ke"}]'::jsonb),
  ('easy', 'kana-easy', 16, '{"text":"Which Hiragana character represents “ra”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ら is the Hiragana character for ra.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"よ"},{"key":"B","text":"り"},{"key":"C","text":"る"},{"key":"D","text":"ら"}]'::jsonb),
  ('easy', 'kana-easy', 17, '{"text":"わ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"わ is pronounced wa.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"wa"},{"key":"B","text":"su"},{"key":"C","text":"se"},{"key":"D","text":"so"}]'::jsonb),
  ('easy', 'kana-easy', 18, '{"text":"ア","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ア is pronounced a.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"chi"},{"key":"B","text":"a"},{"key":"C","text":"tsu"},{"key":"D","text":"te"}]'::jsonb),
  ('easy', 'kana-easy', 19, '{"text":"イ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"イ is pronounced i.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"to"},{"key":"B","text":"na"},{"key":"C","text":"i"},{"key":"D","text":"ni"}]'::jsonb),
  ('easy', 'kana-easy', 20, '{"text":"Which Katakana character represents “u”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ウ is the Katakana character for u.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ナ"},{"key":"B","text":"ニ"},{"key":"C","text":"ヌ"},{"key":"D","text":"ウ"}]'::jsonb),
  ('easy', 'kana-easy', 21, '{"text":"エ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"エ is pronounced e.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"e"},{"key":"B","text":"ha"},{"key":"C","text":"hi"},{"key":"D","text":"fu"}]'::jsonb),
  ('easy', 'kana-easy', 22, '{"text":"オ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"オ is pronounced o.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"he"},{"key":"B","text":"o"},{"key":"C","text":"ho"},{"key":"D","text":"ma"}]'::jsonb),
  ('easy', 'kana-easy', 23, '{"text":"カ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"カ is pronounced ka.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"mi"},{"key":"B","text":"mu"},{"key":"C","text":"ka"},{"key":"D","text":"me"}]'::jsonb),
  ('easy', 'kana-easy', 24, '{"text":"Which Katakana character represents “ki”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"キ is the Katakana character for ki.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"イ"},{"key":"B","text":"ウ"},{"key":"C","text":"エ"},{"key":"D","text":"キ"}]'::jsonb),
  ('easy', 'kana-easy', 25, '{"text":"サ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"サ is pronounced sa.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"sa"},{"key":"B","text":"a"},{"key":"C","text":"i"},{"key":"D","text":"u"}]'::jsonb),
  ('easy', 'kana-easy', 26, '{"text":"シ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"シ is pronounced shi.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"e"},{"key":"B","text":"shi"},{"key":"C","text":"o"},{"key":"D","text":"ka"}]'::jsonb),
  ('easy', 'kana-easy', 27, '{"text":"タ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"タ is pronounced ta.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ki"},{"key":"B","text":"ku"},{"key":"C","text":"ta"},{"key":"D","text":"ke"}]'::jsonb),
  ('easy', 'kana-easy', 28, '{"text":"Which Katakana character represents “na”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ナ is the Katakana character for na.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ヌ"},{"key":"B","text":"ネ"},{"key":"C","text":"ノ"},{"key":"D","text":"ナ"}]'::jsonb),
  ('easy', 'kana-easy', 29, '{"text":"ニ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ニ is pronounced ni.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ni"},{"key":"B","text":"su"},{"key":"C","text":"se"},{"key":"D","text":"so"}]'::jsonb),
  ('easy', 'kana-easy', 30, '{"text":"ハ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ハ is pronounced ha.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"ta"},{"key":"B","text":"ha"},{"key":"C","text":"chi"},{"key":"D","text":"tsu"}]'::jsonb),
  ('easy', 'kana-easy', 31, '{"text":"マ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"マ is pronounced ma.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"te"},{"key":"B","text":"to"},{"key":"C","text":"ma"},{"key":"D","text":"na"}]'::jsonb),
  ('easy', 'kana-easy', 32, '{"text":"Which Katakana character represents “ya”?","instruction":"Choose the matching kana."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ヤ is the Katakana character for ya.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"エ"},{"key":"B","text":"オ"},{"key":"C","text":"カ"},{"key":"D","text":"ヤ"}]'::jsonb),
  ('easy', 'kana-easy', 33, '{"text":"ン","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ン is pronounced n.","category":"kana","difficulty":"easy"}'::jsonb, '[{"key":"A","text":"n"},{"key":"B","text":"no"},{"key":"C","text":"ha"},{"key":"D","text":"hi"}]'::jsonb),
  ('medium', 'kana-medium', 1, '{"text":"が","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"が is read ga. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"ge"}]'::jsonb),
  ('medium', 'kana-medium', 2, '{"text":"ぎ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ぎ is read gi. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"go"},{"key":"B","text":"gi"},{"key":"C","text":"za"},{"key":"D","text":"ji"}]'::jsonb),
  ('medium', 'kana-medium', 3, '{"text":"ぐ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ぐ is read gu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"zu"},{"key":"B","text":"ze"},{"key":"C","text":"gu"},{"key":"D","text":"zo"}]'::jsonb),
  ('medium', 'kana-medium', 4, '{"text":"Which sound matches げ?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"げ is read ge. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"ge"}]'::jsonb),
  ('medium', 'kana-medium', 5, '{"text":"ご","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ご is read go. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"go"},{"key":"B","text":"bi"},{"key":"C","text":"pa"},{"key":"D","text":"pu"}]'::jsonb),
  ('medium', 'kana-medium', 6, '{"text":"ざ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ざ is read za. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"po"},{"key":"B","text":"za"},{"key":"C","text":"kya"},{"key":"D","text":"kyu"}]'::jsonb),
  ('medium', 'kana-medium', 7, '{"text":"じ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"じ is read ji. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"sho"},{"key":"B","text":"chu"},{"key":"C","text":"ji"},{"key":"D","text":"nya"}]'::jsonb),
  ('medium', 'kana-medium', 8, '{"text":"Which sound matches ず?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ず is read zu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"zu"}]'::jsonb),
  ('medium', 'kana-medium', 9, '{"text":"ぜ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ぜ is read ze. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ze"},{"key":"B","text":"gu"},{"key":"C","text":"ge"},{"key":"D","text":"go"}]'::jsonb),
  ('medium', 'kana-medium', 10, '{"text":"ぞ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ぞ is read zo. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"za"},{"key":"B","text":"zo"},{"key":"C","text":"ji"},{"key":"D","text":"zu"}]'::jsonb),
  ('medium', 'kana-medium', 11, '{"text":"だ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"だ is read da. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ze"},{"key":"B","text":"zo"},{"key":"C","text":"da"},{"key":"D","text":"de"}]'::jsonb),
  ('medium', 'kana-medium', 12, '{"text":"Which sound matches で?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"で is read de. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"de"}]'::jsonb),
  ('medium', 'kana-medium', 13, '{"text":"ば","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ば is read ba. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ba"},{"key":"B","text":"pu"},{"key":"C","text":"po"},{"key":"D","text":"kya"}]'::jsonb),
  ('medium', 'kana-medium', 14, '{"text":"び","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"び is read bi. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"kyu"},{"key":"B","text":"bi"},{"key":"C","text":"sho"},{"key":"D","text":"chu"}]'::jsonb),
  ('medium', 'kana-medium', 15, '{"text":"ぱ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ぱ is read pa. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"nya"},{"key":"B","text":"ryu"},{"key":"C","text":"pa"},{"key":"D","text":"ga"}]'::jsonb),
  ('medium', 'kana-medium', 16, '{"text":"Which sound matches ぷ?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ぷ is read pu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"pu"}]'::jsonb),
  ('medium', 'kana-medium', 17, '{"text":"ガ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ガ is read ga. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"za"},{"key":"C","text":"ji"},{"key":"D","text":"zu"}]'::jsonb),
  ('medium', 'kana-medium', 18, '{"text":"ギ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ギ is read gi. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ze"},{"key":"B","text":"gi"},{"key":"C","text":"zo"},{"key":"D","text":"da"}]'::jsonb),
  ('medium', 'kana-medium', 19, '{"text":"グ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"グ is read gu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"de"},{"key":"B","text":"ba"},{"key":"C","text":"gu"},{"key":"D","text":"bi"}]'::jsonb),
  ('medium', 'kana-medium', 20, '{"text":"Which sound matches ゲ?","instruction":"Choose the katakana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ゲ is read ge. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"ge"}]'::jsonb),
  ('medium', 'kana-medium', 21, '{"text":"ゴ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ゴ is read go. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"go"},{"key":"B","text":"kya"},{"key":"C","text":"kyu"},{"key":"D","text":"sho"}]'::jsonb),
  ('medium', 'kana-medium', 22, '{"text":"ザ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ザ is read za. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"chu"},{"key":"B","text":"za"},{"key":"C","text":"nya"},{"key":"D","text":"ryu"}]'::jsonb),
  ('medium', 'kana-medium', 23, '{"text":"ジ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ジ is read ji. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"ji"},{"key":"D","text":"gu"}]'::jsonb),
  ('medium', 'kana-medium', 24, '{"text":"Which sound matches ズ?","instruction":"Choose the katakana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ズ is read zu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"zu"}]'::jsonb),
  ('medium', 'kana-medium', 25, '{"text":"バ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"バ is read ba. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ba"},{"key":"B","text":"ji"},{"key":"C","text":"zu"},{"key":"D","text":"ze"}]'::jsonb),
  ('medium', 'kana-medium', 26, '{"text":"ポ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ポ is read po. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"zo"},{"key":"B","text":"po"},{"key":"C","text":"da"},{"key":"D","text":"de"}]'::jsonb),
  ('medium', 'kana-medium', 27, '{"text":"きゃ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"きゃ is read kya. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ba"},{"key":"B","text":"bi"},{"key":"C","text":"kya"},{"key":"D","text":"pa"}]'::jsonb),
  ('medium', 'kana-medium', 28, '{"text":"Which sound matches きゅ?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"きゅ is read kyu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"kyu"}]'::jsonb),
  ('medium', 'kana-medium', 29, '{"text":"しょ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"しょ is read sho. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"sho"},{"key":"B","text":"kyu"},{"key":"C","text":"chu"},{"key":"D","text":"nya"}]'::jsonb),
  ('medium', 'kana-medium', 30, '{"text":"ちゅ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ちゅ is read chu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ryu"},{"key":"B","text":"chu"},{"key":"C","text":"ga"},{"key":"D","text":"gi"}]'::jsonb),
  ('medium', 'kana-medium', 31, '{"text":"にゃ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"にゃ is read nya. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"gu"},{"key":"B","text":"ge"},{"key":"C","text":"nya"},{"key":"D","text":"go"}]'::jsonb),
  ('medium', 'kana-medium', 32, '{"text":"Which sound matches りゅ?","instruction":"Choose the hiragana reading."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"りゅ is read ryu. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"ga"},{"key":"B","text":"gi"},{"key":"C","text":"gu"},{"key":"D","text":"ryu"}]'::jsonb),
  ('medium', 'kana-medium', 33, '{"text":"キャ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"キャ is read kya. This is a voiced or combined kana sound.","category":"kana","difficulty":"medium"}'::jsonb, '[{"key":"A","text":"kya"},{"key":"B","text":"ze"},{"key":"C","text":"zo"},{"key":"D","text":"da"}]'::jsonb),
  ('hard', 'kana-hard', 1, '{"text":"ぬ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ぬ has a looped finish; do not confuse it with め (me).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"nu"},{"key":"B","text":"me"},{"key":"C","text":"re"},{"key":"D","text":"ne"}]'::jsonb),
  ('hard', 'kana-hard', 2, '{"text":"め","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"め is read me; compare its crossing strokes with ぬ (nu).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ru"},{"key":"B","text":"me"},{"key":"C","text":"ro"},{"key":"D","text":"sa"}]'::jsonb),
  ('hard', 'kana-hard', 3, '{"text":"れ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"れ is read re; it is different from ね (ne).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"chi"},{"key":"B","text":"shi"},{"key":"C","text":"re"},{"key":"D","text":"tsu"}]'::jsonb),
  ('hard', 'kana-hard', 4, '{"text":"ね","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ね is read ne; look for its distinctive right-hand loop.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"so"},{"key":"B","text":"n"},{"key":"C","text":"ku"},{"key":"D","text":"ne"}]'::jsonb),
  ('hard', 'kana-hard', 5, '{"text":"る","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"る is read ru; it is different from ろ (ro).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ru"},{"key":"B","text":"ke"},{"key":"C","text":"wa"},{"key":"D","text":"ra"}]'::jsonb),
  ('hard', 'kana-hard', 6, '{"text":"ろ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ろ is read ro and has a simpler shape than る (ru).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"nu"},{"key":"B","text":"ro"},{"key":"C","text":"me"},{"key":"D","text":"re"}]'::jsonb),
  ('hard', 'kana-hard', 7, '{"text":"さ","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"さ is read sa; do not confuse it with ち (chi).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ne"},{"key":"B","text":"ru"},{"key":"C","text":"sa"},{"key":"D","text":"ro"}]'::jsonb),
  ('hard', 'kana-hard', 8, '{"text":"ち","instruction":"Choose the sound for this hiragana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ち is read chi; its stroke shape differs from さ (sa).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"sa"},{"key":"B","text":"shi"},{"key":"C","text":"tsu"},{"key":"D","text":"chi"}]'::jsonb),
  ('hard', 'kana-hard', 9, '{"text":"シ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"シ is shi; its short strokes angle differently from ツ (tsu).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"shi"},{"key":"B","text":"so"},{"key":"C","text":"n"},{"key":"D","text":"ku"}]'::jsonb),
  ('hard', 'kana-hard', 10, '{"text":"ツ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ツ is tsu; compare its top strokes with シ (shi).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ke"},{"key":"B","text":"tsu"},{"key":"C","text":"wa"},{"key":"D","text":"ra"}]'::jsonb),
  ('hard', 'kana-hard', 11, '{"text":"ソ","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ソ is so; it is often confused with ン (n).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"nu"},{"key":"B","text":"me"},{"key":"C","text":"so"},{"key":"D","text":"re"}]'::jsonb),
  ('hard', 'kana-hard', 12, '{"text":"ン","instruction":"Choose the sound for this katakana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ン is n; compare the direction of its long stroke with ソ (so).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ne"},{"key":"B","text":"ru"},{"key":"C","text":"ro"},{"key":"D","text":"n"}]'::jsonb),
  ('hard', 'kana-hard', 13, '{"text":"きって","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"きって is kitte. The small っ doubles the following consonant.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"kitte"},{"key":"B","text":"kite"},{"key":"C","text":"kide"},{"key":"D","text":"kitti"}]'::jsonb),
  ('hard', 'kana-hard', 14, '{"text":"がっこう","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"がっこう is gakkou. The small っ doubles the k sound.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"gakou"},{"key":"B","text":"gakkou"},{"key":"C","text":"gakko"},{"key":"D","text":"gakkōu"}]'::jsonb),
  ('hard', 'kana-hard', 15, '{"text":"ざっし","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ざっし is zasshi. The small っ doubles the following sh consonant.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"zashi"},{"key":"B","text":"zatsu"},{"key":"C","text":"zasshi"},{"key":"D","text":"zasshu"}]'::jsonb),
  ('hard', 'kana-hard', 16, '{"text":"きっぷ","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"きっぷ is kippu. The small っ doubles the p sound.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"kipu"},{"key":"B","text":"kifu"},{"key":"C","text":"kibbu"},{"key":"D","text":"kippu"}]'::jsonb),
  ('hard', 'kana-hard', 17, '{"text":"ちょっと","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ちょっと is chotto: ちょ is cho and small っ doubles t.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"chotto"},{"key":"B","text":"choto"},{"key":"C","text":"chooto"},{"key":"D","text":"tsotto"}]'::jsonb),
  ('hard', 'kana-hard', 18, '{"text":"スーパー","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"スーパー is suupaa. The long-vowel mark ー extends the preceding vowel.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"supaa"},{"key":"B","text":"suupaa"},{"key":"C","text":"suupa"},{"key":"D","text":"supa"}]'::jsonb),
  ('hard', 'kana-hard', 19, '{"text":"コーヒー","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"コーヒー is koohii. Both ー marks lengthen the preceding vowel.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"kohii"},{"key":"B","text":"koohi"},{"key":"C","text":"koohii"},{"key":"D","text":"kouhii"}]'::jsonb),
  ('hard', 'kana-hard', 20, '{"text":"ケーキ","instruction":"Choose the correct reading of this word."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ケーキ is keeki. The long-vowel mark extends the e sound.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"keki"},{"key":"B","text":"keiki"},{"key":"C","text":"keekii"},{"key":"D","text":"keeki"}]'::jsonb),
  ('hard', 'kana-hard', 21, '{"text":"ティ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ティ is a modern Katakana combination used for loanword sounds such as ti.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"ti"},{"key":"B","text":"di"},{"key":"C","text":"fa"},{"key":"D","text":"fi"}]'::jsonb),
  ('hard', 'kana-hard', 22, '{"text":"ディ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ディ is a modern Katakana combination used for loanword sounds such as di.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"fe"},{"key":"B","text":"di"},{"key":"C","text":"fo"},{"key":"D","text":"wi"}]'::jsonb),
  ('hard', 'kana-hard', 23, '{"text":"ファ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ファ is a modern Katakana combination used for loanword sounds such as fa.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"we"},{"key":"B","text":"va"},{"key":"C","text":"fa"},{"key":"D","text":"che"}]'::jsonb),
  ('hard', 'kana-hard', 24, '{"text":"フィ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"フィ is a modern Katakana combination used for loanword sounds such as fi.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"kya"},{"key":"B","text":"sha"},{"key":"C","text":"tsu"},{"key":"D","text":"fi"}]'::jsonb),
  ('hard', 'kana-hard', 25, '{"text":"フェ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"フェ is a modern Katakana combination used for loanword sounds such as fe.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"fe"},{"key":"B","text":"shi"},{"key":"C","text":"ti"},{"key":"D","text":"di"}]'::jsonb),
  ('hard', 'kana-hard', 26, '{"text":"フォ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"フォ is a modern Katakana combination used for loanword sounds such as fo.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"fa"},{"key":"B","text":"fo"},{"key":"C","text":"fi"},{"key":"D","text":"fe"}]'::jsonb),
  ('hard', 'kana-hard', 27, '{"text":"ウィ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ウィ is a modern Katakana combination used for loanword sounds such as wi.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"fo"},{"key":"B","text":"we"},{"key":"C","text":"wi"},{"key":"D","text":"va"}]'::jsonb),
  ('hard', 'kana-hard', 28, '{"text":"ウェ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ウェ is a modern Katakana combination used for loanword sounds such as we.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"che"},{"key":"B","text":"kya"},{"key":"C","text":"sha"},{"key":"D","text":"we"}]'::jsonb),
  ('hard', 'kana-hard', 29, '{"text":"ヴァ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ヴァ is a modern Katakana combination used for loanword sounds such as va.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"va"},{"key":"B","text":"tsu"},{"key":"C","text":"shi"},{"key":"D","text":"ti"}]'::jsonb),
  ('hard', 'kana-hard', 30, '{"text":"チェ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"チェ is a modern Katakana combination used for loanword sounds such as che.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"di"},{"key":"B","text":"che"},{"key":"C","text":"fa"},{"key":"D","text":"fi"}]'::jsonb),
  ('hard', 'kana-hard', 31, '{"text":"っ","instruction":"What does this small Hiragana character do?"}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"Small っ marks a brief pause and doubles the consonant that follows.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"doubles the next consonant"},{"key":"B","text":"lengthens the vowel"},{"key":"C","text":"nasalises the vowel"},{"key":"D","text":"stands for tsu"}]'::jsonb),
  ('hard', 'kana-hard', 32, '{"text":"ー","instruction":"What does this Katakana mark do?"}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"The long-vowel mark ー extends the preceding vowel sound.","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"doubles the next consonant"},{"key":"B","text":"lengthens the preceding vowel"},{"key":"C","text":"changes k to g"},{"key":"D","text":"marks a question"}]'::jsonb),
  ('hard', 'kana-hard', 33, '{"text":"ゃ","instruction":"How is this small Hiragana character used in a combination?"}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"Small ゃ combines with an i-row kana, as in きゃ (kya).","category":"kana","difficulty":"hard"}'::jsonb, '[{"key":"A","text":"as a standalone ya sound"},{"key":"B","text":"to double a consonant"},{"key":"C","text":"after an i-row kana to form a yōon sound"},{"key":"D","text":"to lengthen a vowel"}]'::jsonb);

insert into public.quiz_questions
  (quiz_id, question_type, prompt, points, sort_order, is_active)
select q.id, 'single_choice'::public.quiz_question_type,
       s.prompt, 1, s.sort_order, true
from public.quizzes q
join kana_question_seed s on s.quiz_slug = q.slug
on conflict (quiz_id, sort_order) do update set
  question_type = excluded.question_type,
  prompt = excluded.prompt,
  points = excluded.points,
  is_active = true,
  updated_at = now();

update public.quiz_questions qq
set is_active = false, updated_at = now()
from public.quizzes q
where q.id = qq.quiz_id
  and q.slug in ('kana-easy','kana-medium','kana-hard')
  and qq.sort_order > 33;

delete from public.quiz_options
where question_id in (
  select qq.id
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  where q.slug in ('kana-easy','kana-medium','kana-hard')
    and qq.sort_order between 1 and 33
);

insert into private.quiz_answer_keys (question_id, answer_key, explanation)
select qq.id, s.answer_key, s.explanation
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join kana_question_seed s on s.quiz_slug = q.slug and s.sort_order = qq.sort_order
on conflict (question_id) do update set
  answer_key = excluded.answer_key,
  explanation = excluded.explanation,
  updated_at = now();

insert into public.quiz_options (question_id, option_key, option_content, sort_order)
select qq.id,
       option_row.value->>'key',
       jsonb_build_object('text', option_row.value->>'text'),
       option_row.ordinality::integer
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join kana_question_seed s on s.quiz_slug = q.slug and s.sort_order = qq.sort_order
cross join lateral jsonb_array_elements(s.options) with ordinality as option_row(value, ordinality)
on conflict (question_id, option_key) do update set
  option_content = excluded.option_content,
  sort_order = excluded.sort_order;

commit;
