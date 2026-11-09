-- The particles assessment belongs to the Grammar unit, not Daily Practice.
-- This makes a passed grammar assessment update the matching curriculum lesson.
begin;

update public.quizzes q
set lesson_id = l.id,
    updated_at = now()
from public.lessons l
join public.course_units u on u.id = l.unit_id
join public.courses c on c.id = u.course_id
where q.slug = 'n5-grammar-particles'
  and c.slug = 'nihongo-n5-foundations'
  and u.slug = 'grammar'
  and l.slug = 'particles';

commit;
