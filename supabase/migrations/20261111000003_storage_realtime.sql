-- =====================================================================
-- 0003: Storage למסמכים + Realtime (סנכרון חי בין הטלפון למחשב)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)   -- 50MB
on conflict (id) do nothing;

-- כל משתמש ניגש רק לתיקייה <user_id>/...
create policy "documents_own_select" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_own_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime
alter publication supabase_realtime add table
  public.tasks, public.topics, public.task_groups, public.sprints, public.goals, public.labels,
  public.task_labels, public.checklist_items, public.time_entries, public.documents,
  public.task_dependencies, public.habits, public.habit_logs, public.workspaces,
  public.saved_views, public.task_templates, public.profiles;
