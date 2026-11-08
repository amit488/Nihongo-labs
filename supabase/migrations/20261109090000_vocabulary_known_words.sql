begin;

create table public.user_vocabulary_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary_entries(id) on delete cascade,
  learned_at timestamptz not null default now(),
  primary key (user_id, vocabulary_id)
);

create index user_vocabulary_progress_user_idx
  on public.user_vocabulary_progress(user_id, learned_at desc);
create index user_vocabulary_progress_vocabulary_idx
  on public.user_vocabulary_progress(vocabulary_id);

alter table public.user_vocabulary_progress enable row level security;

grant select, insert, delete on public.user_vocabulary_progress to authenticated;
grant select, insert, delete on public.user_vocabulary_progress to service_role;

create policy user_vocabulary_progress_read_own
on public.user_vocabulary_progress for select to authenticated
using (user_id = (select auth.uid()));

create policy user_vocabulary_progress_insert_own
on public.user_vocabulary_progress for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.vocabulary_entries v
    where v.id = user_vocabulary_progress.vocabulary_id
      and v.publication_status = 'published'
  )
);

create policy user_vocabulary_progress_delete_own
on public.user_vocabulary_progress for delete to authenticated
using (user_id = (select auth.uid()));

commit;
