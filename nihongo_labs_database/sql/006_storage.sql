-- Nihongo Labs — Supabase Storage buckets and object policies
-- Run after the core schema and RLS helper functions have been installed.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('nihongo-public', 'nihongo-public', true, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4', 'application/pdf']),
  ('nihongo-premium', 'nihongo-premium', false, 52428800,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4', 'application/pdf']),
  ('nihongo-avatars', 'nihongo-avatars', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('nihongo-private', 'nihongo-private', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public lesson assets are readable by everyone; writes are reserved for editors/admins.
create policy nihongo_public_assets_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'nihongo-public');

create policy nihongo_public_assets_insert_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_public_assets_update_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
)
with check (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_public_assets_delete_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-public'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);


-- Premium media must live in a private bucket; signed URLs should be generated server-side / after entitlement checks.
create policy nihongo_premium_assets_read_entitled
on storage.objects for select to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (
    private.can_access_content('premium'::public.content_access)
    or (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
  )
);

create policy nihongo_premium_assets_insert_staff
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_premium_assets_update_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
)
with check (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

create policy nihongo_premium_assets_delete_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-premium'
  and (select private.has_any_role(array['super_admin', 'admin', 'content_editor']::public.app_role[]))
);

-- Avatar object names must begin with the authenticated user's UUID.
create policy nihongo_avatars_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'nihongo-avatars');

create policy nihongo_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Private support attachments: owner and support staff can read; users can upload only into their own folder.
create policy nihongo_private_files_read_owner_or_staff
on storage.objects for select to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

create policy nihongo_private_files_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'nihongo-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy nihongo_private_files_update_owner_or_staff
on storage.objects for update to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
)
with check (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

create policy nihongo_private_files_delete_owner_or_staff
on storage.objects for delete to authenticated
using (
  bucket_id = 'nihongo-private'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.has_any_role(array['super_admin', 'admin', 'support_agent']::public.app_role[]))
  )
);

commit;
