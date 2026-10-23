do $$begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='category_sigo_daily') then
  alter publication supabase_realtime add table public.category_sigo_daily;
 end if;
end$$;
