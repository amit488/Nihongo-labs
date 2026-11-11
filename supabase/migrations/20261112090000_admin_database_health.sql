-- Read-only database inventory for the protected Nihongo Labs admin console.
-- Row counts come from PostgreSQL statistics (estimates), not table scans.
create or replace function public.get_admin_database_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with table_stats as (
    select
      n.nspname as schema_name,
      c.relname as table_name,
      greatest(coalesce(s.n_live_tup, c.reltuples, 0), 0)::bigint as estimated_rows,
      pg_catalog.pg_total_relation_size(c.oid)::bigint as total_bytes,
      pg_catalog.pg_relation_size(c.oid)::bigint as data_bytes,
      pg_catalog.pg_indexes_size(c.oid)::bigint as index_bytes
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    left join pg_catalog.pg_stat_user_tables s
      on s.relid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  )
  select jsonb_build_object(
    'database_name', pg_catalog.current_database(),
    'database_size_bytes', pg_catalog.pg_database_size(pg_catalog.current_database()),
    'table_count', count(*)::integer,
    'empty_table_count', count(*) filter (where estimated_rows = 0)::integer,
    'populated_table_count', count(*) filter (where estimated_rows > 0)::integer,
    'estimated_row_count', coalesce(sum(estimated_rows), 0)::bigint,
    'tables', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'schema', schema_name,
          'name', table_name,
          'estimated_rows', estimated_rows,
          'total_bytes', total_bytes,
          'data_bytes', data_bytes,
          'index_bytes', index_bytes
        )
        order by estimated_rows desc, total_bytes desc, table_name
      ),
      '[]'::jsonb
    )
  )
  from table_stats;
$$;

revoke all on function public.get_admin_database_health() from public, anon, authenticated;
grant execute on function public.get_admin_database_health() to service_role;
