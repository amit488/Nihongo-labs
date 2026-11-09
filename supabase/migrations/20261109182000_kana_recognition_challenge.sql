-- Make kana recognition independent of JLPT level and seed a complete, timed mixed-script challenge.
begin;

insert into public.courses
  (slug, title, subtitle, description, jlpt_level, access_level, publication_status,
   learning_outcomes, estimated_duration_minutes, sort_order, published_at)
values
  ('nihongo-n5-foundations', 'JLPT N5 Foundations',
   'A clear path from kana to confident beginner Japanese',
   'A structured beginner course covering kana, grammar, vocabulary, kanji and reading.',
   'N5', 'free', 'published',
   '["Read and write basic kana","Understand essential N5 grammar","Build everyday vocabulary","Recognise common N5 kanji","Read short beginner passages"]'::jsonb,
   900, 1, now())
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  access_level = excluded.access_level,
  publication_status = 'published',
  learning_outcomes = excluded.learning_outcomes,
  estimated_duration_minutes = excluded.estimated_duration_minutes,
  published_at = coalesce(public.courses.published_at, now()),
  updated_at = now();

insert into public.course_units
  (course_id, slug, title, description, publication_status, sort_order)
select id, 'kana', 'Kana: Hiragana & Katakana',
       'Recognise and write the two Japanese syllabaries.', 'published', 1
from public.courses where slug = 'nihongo-n5-foundations'
on conflict (course_id, slug) do update set
  title = excluded.title,
  description = excluded.description,
  publication_status = 'published',
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.lessons
  (unit_id, slug, title, summary, lesson_type, access_level, publication_status,
   estimated_duration_minutes, sort_order)
select id, 'hiragana', 'Hiragana characters',
       'Learn the basic Hiragana characters and practise recognising their sounds.',
       'lesson', 'free', 'published', 8, 1
from public.course_units
where slug = 'kana'
  and course_id = (select id from public.courses where slug = 'nihongo-n5-foundations')
on conflict (unit_id, slug) do update set
  title = excluded.title,
  summary = excluded.summary,
  lesson_type = excluded.lesson_type,
  access_level = excluded.access_level,
  publication_status = 'published',
  estimated_duration_minutes = excluded.estimated_duration_minutes,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Reuse the prior quiz row so learner attempt history remains attached to the same quiz.
update public.quizzes
set slug = 'kana-recognition-challenge'
where slug = 'n5-kana-practice'
  and not exists (select 1 from public.quizzes where slug = 'kana-recognition-challenge');

update public.quizzes
set publication_status = 'draft', updated_at = now()
where slug = 'n5-kana-practice';

insert into public.quizzes
  (lesson_id, slug, title, description, access_level, publication_status,
   time_limit_seconds, pass_percentage, shuffle_questions, show_results_after_submit, sort_order)
select l.id, 'kana-recognition-challenge', 'Kana Recognition Challenge',
       'Recognise Hiragana and Katakana, including similar-looking characters and combined sounds.',
       'free', 'published', 900, 75, true, true, 3
from public.lessons l
join public.course_units u on u.id = l.unit_id
join public.courses c on c.id = u.course_id
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

-- Kana recognition challenge: mixed Hiragana, Katakana, dakuten, handakuten and yoon.
-- Each question receives a fresh 45-second window in the client runner.
create temporary table kana_recognition_seed (
  sort_order integer primary key,
  prompt jsonb not null,
  answer_key jsonb not null,
  explanation jsonb not null,
  options jsonb not null
) on commit drop;

insert into kana_recognition_seed (sort_order, prompt, answer_key, explanation, options)
values
  (1, '{"text":"あ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"あ is pronounced a.","category":"kana"}'::jsonb, '[{"key":"A","text":"a"},{"key":"B","text":"i"},{"key":"C","text":"e"},{"key":"D","text":"o"}]'::jsonb),
  (2, '{"text":"Which kana is read shi?","instruction":"Choose the correct Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"し is pronounced shi. It is different from ち (chi) and つ (tsu).","category":"kana"}'::jsonb, '[{"key":"A","text":"ち"},{"key":"B","text":"し"},{"key":"C","text":"す"},{"key":"D","text":"つ"}]'::jsonb),
  (3, '{"text":"シ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"シ is pronounced shi. Do not confuse it with ツ (tsu).","category":"kana"}'::jsonb, '[{"key":"A","text":"shi"},{"key":"B","text":"tsu"},{"key":"C","text":"so"},{"key":"D","text":"n"}]'::jsonb),
  (4, '{"text":"つ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"つ is pronounced tsu. The sound is not su or shi.","category":"kana"}'::jsonb, '[{"key":"A","text":"su"},{"key":"B","text":"chi"},{"key":"C","text":"tsu"},{"key":"D","text":"te"}]'::jsonb),
  (5, '{"text":"ソ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ソ is pronounced so. Its shape is often confused with ン (n).","category":"kana"}'::jsonb, '[{"key":"A","text":"n"},{"key":"B","text":"so"},{"key":"C","text":"ro"},{"key":"D","text":"re"}]'::jsonb),
  (6, '{"text":"ン","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ン is pronounced n. Compare its stroke direction with ソ (so).","category":"kana"}'::jsonb, '[{"key":"A","text":"so"},{"key":"B","text":"shi"},{"key":"C","text":"tsu"},{"key":"D","text":"n"}]'::jsonb),
  (7, '{"text":"ぬ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"ぬ is pronounced nu. It is visually similar to め (me).","category":"kana"}'::jsonb, '[{"key":"A","text":"ne"},{"key":"B","text":"nu"},{"key":"C","text":"me"},{"key":"D","text":"no"}]'::jsonb),
  (8, '{"text":"メ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"メ is pronounced me. It is different from ヌ (nu).","category":"kana"}'::jsonb, '[{"key":"A","text":"nu"},{"key":"B","text":"mo"},{"key":"C","text":"me"},{"key":"D","text":"mu"}]'::jsonb),
  (9, '{"text":"チ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"チ is pronounced chi. It is not シ (shi) or ツ (tsu).","category":"kana"}'::jsonb, '[{"key":"A","text":"chi"},{"key":"B","text":"shi"},{"key":"C","text":"tsu"},{"key":"D","text":"te"}]'::jsonb),
  (10, '{"text":"きゃ","instruction":"Choose the combined sound for this Hiragana pair."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"きゃ combines き (ki) with small ゃ (ya) to make kya.","category":"kana"}'::jsonb, '[{"key":"A","text":"kyu"},{"key":"B","text":"kyo"},{"key":"C","text":"sha"},{"key":"D","text":"kya"}]'::jsonb),
  (11, '{"text":"キャ","instruction":"Choose the combined sound for this Katakana pair."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"キャ combines キ (ki) with small ャ (ya) to make kya.","category":"kana"}'::jsonb, '[{"key":"A","text":"kyo"},{"key":"B","text":"kya"},{"key":"C","text":"cha"},{"key":"D","text":"kyu"}]'::jsonb),
  (12, '{"text":"しゅ","instruction":"Choose the combined sound for this Hiragana pair."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"しゅ combines し (shi) with small ゅ (yu) to make shu.","category":"kana"}'::jsonb, '[{"key":"A","text":"sho"},{"key":"B","text":"chu"},{"key":"C","text":"shu"},{"key":"D","text":"kyu"}]'::jsonb),
  (13, '{"text":"ジ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"ジ is pronounced ji. It is the voiced form of シ (shi).","category":"kana"}'::jsonb, '[{"key":"A","text":"ji"},{"key":"B","text":"shi"},{"key":"C","text":"chi"},{"key":"D","text":"zu"}]'::jsonb),
  (14, '{"text":"ぎ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ぎ is pronounced gi. The dakuten marks き (ki) as voiced.","category":"kana"}'::jsonb, '[{"key":"A","text":"ki"},{"key":"B","text":"ji"},{"key":"C","text":"ge"},{"key":"D","text":"gi"}]'::jsonb),
  (15, '{"text":"パ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"パ is pronounced pa. The handakuten (small circle) changes ハ (ha) to pa.","category":"kana"}'::jsonb, '[{"key":"A","text":"ba"},{"key":"B","text":"pa"},{"key":"C","text":"ha"},{"key":"D","text":"po"}]'::jsonb),
  (16, '{"text":"ぷ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"ぷ is pronounced pu. The handakuten changes ふ (fu) to pu.","category":"kana"}'::jsonb, '[{"key":"A","text":"bu"},{"key":"B","text":"po"},{"key":"C","text":"pu"},{"key":"D","text":"fu"}]'::jsonb),
  (17, '{"text":"づ","instruction":"Choose the sound for this Hiragana character."}'::jsonb, '{"option_key":"A"}'::jsonb, '{"explanation":"づ is usually romanised zu. It is uncommon, but it is distinct in spelling from ず.","category":"kana"}'::jsonb, '[{"key":"A","text":"zu"},{"key":"B","text":"tsu"},{"key":"C","text":"ji"},{"key":"D","text":"du"}]'::jsonb),
  (18, '{"text":"ワ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"D"}'::jsonb, '{"explanation":"ワ is pronounced wa. It is different from ラ (ra) and レ (re).","category":"kana"}'::jsonb, '[{"key":"A","text":"ra"},{"key":"B","text":"re"},{"key":"C","text":"wo"},{"key":"D","text":"wa"}]'::jsonb),
  (19, '{"text":"Which pair is read kya?","instruction":"Choose the matching Hiragana and Katakana pair."}'::jsonb, '{"option_key":"B"}'::jsonb, '{"explanation":"きゃ and キャ both represent kya; the first is Hiragana and the second is Katakana.","category":"kana"}'::jsonb, '[{"key":"A","text":"きゅ and キュ"},{"key":"B","text":"きゃ and キャ"},{"key":"C","text":"きょ and キョ"},{"key":"D","text":"しゃ and シャ"}]'::jsonb),
  (20, '{"text":"フ","instruction":"Choose the sound for this Katakana character."}'::jsonb, '{"option_key":"C"}'::jsonb, '{"explanation":"フ is pronounced fu. The sound is often written as fu, although it is softer than English f.","category":"kana"}'::jsonb, '[{"key":"A","text":"he"},{"key":"B","text":"ho"},{"key":"C","text":"fu"},{"key":"D","text":"bu"}]'::jsonb);

insert into public.quiz_questions (quiz_id, question_type, prompt, points, sort_order, is_active)
select q.id, 'single_choice'::public.quiz_question_type, s.prompt, 1, s.sort_order, true
from public.quizzes q
cross join kana_recognition_seed s
where q.slug = 'kana-recognition-challenge'
on conflict (quiz_id, sort_order) do update
set question_type = excluded.question_type,
    prompt = excluded.prompt,
    points = excluded.points,
    is_active = excluded.is_active,
    updated_at = now();

update public.quiz_questions
set is_active = false, updated_at = now()
where quiz_id = (select id from public.quizzes where slug = 'kana-recognition-challenge')
  and sort_order > 20;

delete from public.quiz_options
where question_id in (
  select id from public.quiz_questions
  where quiz_id = (select id from public.quizzes where slug = 'kana-recognition-challenge')
    and sort_order between 1 and 20
);

insert into private.quiz_answer_keys (question_id, answer_key, explanation)
select qq.id, s.answer_key, s.explanation
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join kana_recognition_seed s on s.sort_order = qq.sort_order
where q.slug = 'kana-recognition-challenge'
on conflict (question_id) do update
set answer_key = excluded.answer_key,
    explanation = excluded.explanation,
    updated_at = now();

insert into public.quiz_options (question_id, option_key, option_content, sort_order)
select qq.id,
       option_row.value->>'key',
       jsonb_build_object('text', option_row.value->>'text'),
       option_row.ordinality
from public.quiz_questions qq
join public.quizzes q on q.id = qq.quiz_id
join kana_recognition_seed s on s.sort_order = qq.sort_order
cross join lateral jsonb_array_elements(s.options) with ordinality as option_row(value, ordinality)
where q.slug = 'kana-recognition-challenge'
on conflict (question_id, option_key) do update
set option_content = excluded.option_content,
    sort_order = excluded.sort_order;


commit;
