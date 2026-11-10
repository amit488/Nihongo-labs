-- Medium-priority performance improvements:
-- indexed substring search and database-side learner analytics aggregation.
begin;

create extension if not exists pg_trgm with schema extensions;

-- These partial trigram indexes support the existing ILIKE '%query%' filters
-- without changing search semantics or indexing unpublished content.
create index if not exists vocabulary_entries_word_trgm_idx
  on public.vocabulary_entries using gin (word extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists vocabulary_entries_kana_trgm_idx
  on public.vocabulary_entries using gin (kana extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists vocabulary_entries_meaning_trgm_idx
  on public.vocabulary_entries using gin (meaning extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists vocabulary_entries_romaji_trgm_idx
  on public.vocabulary_entries using gin (romaji extensions.gin_trgm_ops)
  where publication_status = 'published';

create index if not exists grammar_points_title_trgm_idx
  on public.grammar_points using gin (title extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists grammar_points_pattern_trgm_idx
  on public.grammar_points using gin (pattern extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists grammar_points_explanation_trgm_idx
  on public.grammar_points using gin (explanation extensions.gin_trgm_ops)
  where publication_status = 'published';

create index if not exists kanji_entries_character_trgm_idx
  on public.kanji_entries using gin (character extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists kanji_entries_meaning_trgm_idx
  on public.kanji_entries using gin (meaning extensions.gin_trgm_ops)
  where publication_status = 'published';

create index if not exists lessons_title_trgm_idx
  on public.lessons using gin (title extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists lessons_summary_trgm_idx
  on public.lessons using gin (summary extensions.gin_trgm_ops)
  where publication_status = 'published';

create index if not exists courses_title_trgm_idx
  on public.courses using gin (title extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists courses_subtitle_trgm_idx
  on public.courses using gin (subtitle extensions.gin_trgm_ops)
  where publication_status = 'published';
create index if not exists courses_description_trgm_idx
  on public.courses using gin (description extensions.gin_trgm_ops)
  where publication_status = 'published';

-- The API previously loaded catalog IDs and progress rows into Node.js merely
-- to count them. This function returns the same response shape using SQL counts.
create or replace function public.get_level_progress(_level text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with caller as (
  select (select auth.uid()) as user_id
),
metrics as (
  select
    (select count(*)::integer
      from public.vocabulary_entries v
      where v.jlpt_level = _level::public.jlpt_level
        and v.publication_status = 'published') as vocabulary_total,
    (select count(*)::integer
      from public.user_vocabulary_progress p
      join public.vocabulary_entries v on v.id = p.vocabulary_id
      where p.user_id = (select user_id from caller)
        and v.jlpt_level = _level::public.jlpt_level
        and v.publication_status = 'published') as vocabulary_completed,
    (select count(*)::integer
      from public.kanji_entries k
      where k.jlpt_level = _level::public.jlpt_level
        and k.publication_status = 'published') as kanji_total,
    (select count(*)::integer
      from public.kanji_review_state s
      join public.kanji_entries k on k.id = s.kanji_id
      where s.user_id = (select user_id from caller)
        and s.status = 'known'
        and k.jlpt_level = _level::public.jlpt_level
        and k.publication_status = 'published') as kanji_completed,
    (select count(*)::integer
      from public.grammar_points g
      where g.jlpt_level = _level::public.jlpt_level
        and g.publication_status = 'published') as grammar_total,
    (select count(*)::integer
      from public.user_grammar_progress p
      join public.grammar_points g on g.id = p.grammar_id
      where p.user_id = (select user_id from caller)
        and g.jlpt_level = _level::public.jlpt_level
        and g.publication_status = 'published') as grammar_completed,
    (select count(*)::integer
      from public.lessons l
      join public.course_units u on u.id = l.unit_id
      join public.courses c on c.id = u.course_id
      where l.publication_status = 'published'
        and u.publication_status = 'published'
        and c.publication_status = 'published'
        and c.jlpt_level = _level::public.jlpt_level) as lessons_total,
    (select count(*)::integer
      from public.lesson_progress p
      join public.lessons l on l.id = p.lesson_id
      join public.course_units u on u.id = l.unit_id
      join public.courses c on c.id = u.course_id
      where p.user_id = (select user_id from caller)
        and p.status = 'completed'
        and l.publication_status = 'published'
        and u.publication_status = 'published'
        and c.publication_status = 'published'
        and c.jlpt_level = _level::public.jlpt_level) as lessons_completed
)
select jsonb_build_object(
  'level', _level,
  'vocabulary', jsonb_build_object('completed', m.vocabulary_completed, 'total', m.vocabulary_total),
  'kanji', jsonb_build_object('completed', m.kanji_completed, 'total', m.kanji_total),
  'grammar', jsonb_build_object('completed', m.grammar_completed, 'total', m.grammar_total),
  'lessons', jsonb_build_object('completed', m.lessons_completed, 'total', m.lessons_total),
  'readiness', (
    select coalesce(
      round(avg(least(100, categories.completed::numeric / categories.total * 100)))::integer,
      0
    )
    from (values
      (m.vocabulary_completed, m.vocabulary_total),
      (m.kanji_completed, m.kanji_total),
      (m.grammar_completed, m.grammar_total),
      (m.lessons_completed, m.lessons_total)
    ) as categories(completed, total)
    where categories.total > 0
  )
)
from metrics m;
$$;

revoke all on function public.get_level_progress(text) from public, anon;
grant execute on function public.get_level_progress(text) to authenticated;

-- Return one compact vocabulary-intelligence payload. The old route fetched
-- thousands of review, learned, and Quick Revision rows and merged them in JS.
create or replace function public.get_vocabulary_intelligence(_level text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with learned_count as (
  select count(*)::integer as value
  from public.user_vocabulary_progress p
  join public.vocabulary_entries v on v.id = p.vocabulary_id
  where p.user_id = (select auth.uid())
    and v.jlpt_level = _level::public.jlpt_level
),
fsrs as (
  select
    v.id,
    v.word,
    v.kana,
    v.romaji,
    v.meaning,
    v.part_of_speech,
    v.example_sentence,
    v.example_reading,
    v.example_translation,
    s.due_at,
    s.repetitions,
    s.interval_days,
    s.last_rating,
    (s.due_at <= now()) as due,
    (s.last_rating <= 2 or (s.due_at <= now() and s.repetitions < 2)) as at_risk,
    (s.repetitions >= 3 and s.due_at > now() and s.last_rating >= 3) as mastered
  from public.vocabulary_review_state s
  join public.vocabulary_entries v on v.id = s.vocabulary_id
  where s.user_id = (select auth.uid())
    and v.jlpt_level = _level::public.jlpt_level
    and v.publication_status = 'published'
),
quick as (
  select
    v.id,
    v.word,
    v.kana,
    v.romaji,
    v.meaning,
    v.part_of_speech,
    v.example_sentence,
    v.example_reading,
    v.example_translation,
    q.next_review_at,
    q.total_attempts,
    q.last_is_correct,
    q.correct_attempts,
    q.incorrect_attempts,
    (q.next_review_at <= now()) as due,
    (q.incorrect_attempts >= 2 or q.last_is_correct is false) as at_risk,
    (q.correct_attempts >= 3 and q.incorrect_attempts = 0 and q.next_review_at > now()) as mastered
  from public.quick_revision_state q
  join public.vocabulary_entries v on v.id = q.content_id
  where q.user_id = (select auth.uid())
    and q.content_type = 'vocabulary'
    and v.jlpt_level = _level::public.jlpt_level
    and v.publication_status = 'published'
),
unified as (
  select
    coalesce(f.id, q.id) as id,
    coalesce(f.word, q.word) as word,
    coalesce(f.kana, q.kana) as kana,
    coalesce(f.romaji, q.romaji) as romaji,
    coalesce(f.meaning, q.meaning) as meaning,
    coalesce(f.part_of_speech, q.part_of_speech) as part_of_speech,
    coalesce(f.example_sentence, q.example_sentence) as example_sentence,
    coalesce(f.example_reading, q.example_reading) as example_reading,
    coalesce(f.example_translation, q.example_translation) as example_translation,
    coalesce(f.due_at, q.next_review_at) as due_at,
    coalesce(f.repetitions, q.total_attempts) as repetitions,
    coalesce(f.interval_days, 0) as interval_days,
    case
      when coalesce(q.at_risk, false) and (f.last_rating is null or f.last_rating > 1) then 1
      when f.id is not null then f.last_rating
      when q.last_is_correct is false then 1
      when q.last_is_correct is true then 4
      else null
    end as last_rating,
    (coalesce(f.due, false) or coalesce(q.due, false)) as due,
    (coalesce(f.at_risk, false) or coalesce(q.at_risk, false)) as at_risk,
    (
      (coalesce(f.mastered, false) or coalesce(q.mastered, false))
      and not (coalesce(f.due, false) or coalesce(q.due, false))
      and not (coalesce(f.at_risk, false) or coalesce(q.at_risk, false))
    ) as mastered
  from fsrs f
  full outer join quick q on q.id = f.id
),
summary as (
  select
    count(*)::integer as tracked_count,
    count(*) filter (where due)::integer as due_count,
    count(*) filter (where at_risk)::integer as at_risk_count,
    count(*) filter (where mastered)::integer as mastered_count
  from unified
),
ranked as (
  select
    u.*,
    row_number() over (
      order by
        case when u.at_risk then 0 else 1 end,
        case when u.at_risk then coalesce(u.last_rating, 5) else 0 end,
        u.due_at asc,
        u.id
    ) as position
  from unified u
  where u.at_risk or u.due
)
select jsonb_build_object(
  'level', _level,
  'learnedCount', (select value from learned_count),
  'trackedCount', s.tracked_count,
  'dueCount', s.due_count,
  'atRiskCount', s.at_risk_count,
  'masteredCount', s.mastered_count,
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'word', r.word,
      'kana', r.kana,
      'romaji', r.romaji,
      'meaning', r.meaning,
      'partOfSpeech', r.part_of_speech,
      'example', r.example_sentence,
      'exampleReading', r.example_reading,
      'exampleMeaning', r.example_translation,
      'dueAt', r.due_at,
      'repetitions', r.repetitions,
      'intervalDays', r.interval_days,
      'lastRating', r.last_rating,
      'due', r.due,
      'atRisk', r.at_risk,
      'mastered', r.mastered
    ) order by r.position)
    from ranked r
    where r.position <= 10
  ), '[]'::jsonb)
)
from summary s;
$$;

revoke all on function public.get_vocabulary_intelligence(text) from public, anon;
grant execute on function public.get_vocabulary_intelligence(text) to authenticated;

-- Grammar insights used to transfer up to 9,000 event rows to Node.js. Group
-- by skill tag in PostgreSQL and send only aggregate topics plus top 10 rows.
create or replace function public.get_grammar_intelligence()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with caller as (
  select (select auth.uid()) as user_id
),
tagged_events as (
  select e.skill_tag, e.is_correct, e.created_at, null::text as label_override
  from public.grammar_attempt_events e
  where e.user_id = (select user_id from caller)
),
quick_source as (
  select
    q.content_id,
    q.is_correct,
    q.created_at,
    g.title,
    g.pattern,
    array(
      select distinct tag
      from unnest(coalesce(g.learning_tags, array[]::text[])) as values_by_tag(tag)
      where tag ~ '^[a-z0-9:_-]{2,80}$'
    ) as valid_tags
  from public.quick_revision_attempts q
  left join public.grammar_points g on g.id = q.content_id
  where q.user_id = (select user_id from caller)
    and q.content_type = 'grammar'
),
quick_events as (
  select
    tags.skill_tag,
    q.is_correct,
    q.created_at,
    coalesce(q.title, q.pattern, 'Grammar point') as label_override
  from quick_source q
  cross join lateral unnest(
    case
      when cardinality(q.valid_tags) > 0 then q.valid_tags
      else array['grammar-point:' || q.content_id::text]
    end
  ) as tags(skill_tag)
),
sentence_events as (
  select
    tags.skill_tag,
    s.is_correct,
    s.created_at,
    null::text as label_override
  from public.sentence_construction_attempts s
  cross join lateral (
    select distinct tag
    from unnest(coalesce(s.grammar_tags, array[]::text[])) as values_by_tag(tag)
    where tag ~ '^[a-z0-9:_-]{2,80}$'
  ) as tags(skill_tag)
  where s.user_id = (select user_id from caller)
),
topic_events as (
  select * from tagged_events
  union all
  select * from quick_events
  union all
  select * from sentence_events
),
topic_aggregates as (
  select
    e.skill_tag as tag,
    count(*)::integer as attempts,
    count(*) filter (where not e.is_correct)::integer as misses,
    round(
      count(*) filter (where e.is_correct)::numeric * 100 / nullif(count(*), 0)
    )::integer as accuracy,
    max(e.created_at) filter (where not e.is_correct) as latest_miss,
    (array_agg(e.is_correct order by e.created_at desc))[1] as latest_is_correct,
    max(e.label_override) filter (where e.label_override is not null) as label_override
  from topic_events e
  group by e.skill_tag
),
topic_results as (
  select
    a.*,
    (
      a.misses >= 2
      or (a.attempts >= 2 and a.accuracy < 70)
      or (not a.latest_is_correct and a.attempts >= 1)
    ) as weak
  from topic_aggregates a
),
totals as (
  select
    (
      (select count(*) from public.grammar_attempt_events e where e.user_id = (select user_id from caller))
      + (select count(*) from public.quick_revision_attempts q where q.user_id = (select user_id from caller) and q.content_type = 'grammar')
      + (select count(*) from public.sentence_construction_attempts s where s.user_id = (select user_id from caller))
    )::integer as attempts,
    (
      (select count(*) from public.grammar_attempt_events e where e.user_id = (select user_id from caller) and e.is_correct)
      + (select count(*) from public.quick_revision_attempts q where q.user_id = (select user_id from caller) and q.content_type = 'grammar' and q.is_correct)
      + (select count(*) from public.sentence_construction_attempts s where s.user_id = (select user_id from caller) and s.is_correct)
    )::integer as correct
),
topic_payload as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'tag', r.tag,
    'attempts', r.attempts,
    'misses', r.misses,
    'accuracy', r.accuracy,
    'latestMiss', r.latest_miss,
    'weak', r.weak,
    'labelOverride', r.label_override
  ) order by r.weak desc, r.misses desc, r.accuracy asc), '[]'::jsonb) as topics
  from (
    select * from topic_results
    order by weak desc, misses desc, accuracy asc
    limit 10
  ) r
)
select jsonb_build_object(
  'totalAttempts', t.attempts,
  'accuracy', case when t.attempts > 0 then round(t.correct::numeric * 100 / t.attempts)::integer else 0 end,
  'weakTopicCount', (select count(*)::integer from topic_results where weak),
  'topics', p.topics,
  'hasTaggedHistory', t.attempts > 0
)
from totals t cross join topic_payload p;
$$;

revoke all on function public.get_grammar_intelligence() from public, anon;
grant execute on function public.get_grammar_intelligence() to authenticated;

commit;
