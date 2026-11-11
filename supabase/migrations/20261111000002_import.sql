-- =====================================================================
-- 0002: ייבוא נתונים (מהפורמט הישן, אחרי נרמול בצד הלקוח), Storage, Realtime
-- =====================================================================

-- p: אובייקט JSON עם מערכים מנורמלים (ראו web/src/lib/legacyImport.ts)
-- p_workspace: לאיזה מרחב לייבא נושאים/משימות/ספרינטים/מטרות
-- p_replace: true = למחוק קודם את תוכן המרחב
create or replace function public.import_data(p jsonb, p_workspace text, p_replace boolean default false)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  n_tasks int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from workspaces where id = p_workspace and user_id = uid) then
    raise exception 'workspace not found';
  end if;

  perform set_config('app.importing', '1', true);

  if p_replace then
    delete from tasks where workspace_id = p_workspace;
    delete from sprints where workspace_id = p_workspace;
    delete from goals where workspace_id = p_workspace;
    delete from topics where workspace_id = p_workspace;
  end if;

  insert into topics (id, user_id, workspace_id, name, color, icon, position, is_archived, created_at)
  select r.id, uid, p_workspace, r.name, coalesce(r.color,'#579BFC'), r.icon,
         coalesce(r.position,0), coalesce(r.is_archived,false), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::topics, coalesce(p->'topics','[]')) r
  on conflict (id) do nothing;

  insert into task_groups (id, user_id, topic_id, name, color, position, is_collapsed)
  select r.id, uid, r.topic_id, r.name, coalesce(r.color,'#A25DDC'), coalesce(r.position,0),
         coalesce(r.is_collapsed,false)
  from jsonb_populate_recordset(null::task_groups, coalesce(p->'task_groups','[]')) r
  where exists (select 1 from topics t where t.id = r.topic_id and t.user_id = uid)
  on conflict (id) do nothing;

  insert into goals (id, user_id, workspace_id, title, description, period, target_date, color, position, created_at)
  select r.id, uid, p_workspace, r.title, coalesce(r.description,''), coalesce(r.period,'quarter'),
         r.target_date, coalesce(r.color,'#00C875'), coalesce(r.position,0), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::goals, coalesce(p->'goals','[]')) r
  on conflict (id) do nothing;

  insert into sprints (id, user_id, workspace_id, name, color, start_date, end_date, topic_id, goal_id, position, created_at)
  select r.id, uid, p_workspace, r.name, coalesce(r.color,'#00C875'), r.start_date, r.end_date,
         r.topic_id, r.goal_id, coalesce(r.position,0), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::sprints, coalesce(p->'sprints','[]')) r
  on conflict (id) do nothing;

  insert into labels (id, user_id, name, color)
  select r.id, uid, r.name, coalesce(r.color,'#579BFC')
  from jsonb_populate_recordset(null::labels, coalesce(p->'labels','[]')) r
  on conflict (id) do nothing;

  insert into tasks (id, user_id, workspace_id, topic_id, group_id, parent_id, title, description,
                     status, priority, due_date, due_time, start_date, plan_period, plan_anchor,
                     estimate_minutes, recurrence_rule, recurrence_parent_id, sprint_id, goal_id,
                     color, position, completed_at, is_archived, created_at, updated_at)
  select r.id, uid, p_workspace, r.topic_id, r.group_id, r.parent_id, r.title, coalesce(r.description,''),
         coalesce(r.status,'todo'), coalesce(r.priority,'medium'), r.due_date, r.due_time, r.start_date,
         coalesce(r.plan_period,'none'), r.plan_anchor, r.estimate_minutes, r.recurrence_rule,
         r.recurrence_parent_id, r.sprint_id, r.goal_id, r.color, coalesce(r.position,0),
         r.completed_at, coalesce(r.is_archived,false), coalesce(r.created_at, now()),
         coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::tasks, coalesce(p->'tasks','[]')) r
  on conflict (id) do nothing;
  get diagnostics n_tasks = row_count;

  insert into task_labels (task_id, label_id, user_id)
  select r.task_id, r.label_id, uid
  from jsonb_populate_recordset(null::task_labels, coalesce(p->'task_labels','[]')) r
  where exists (select 1 from tasks where id = r.task_id and user_id = uid)
    and exists (select 1 from labels where id = r.label_id and user_id = uid)
  on conflict do nothing;

  insert into checklist_items (id, user_id, task_id, text, is_done, position)
  select r.id, uid, r.task_id, r.text, coalesce(r.is_done,false), coalesce(r.position,0)
  from jsonb_populate_recordset(null::checklist_items, coalesce(p->'checklist_items','[]')) r
  where exists (select 1 from tasks where id = r.task_id and user_id = uid)
  on conflict (id) do nothing;

  insert into time_entries (id, user_id, task_id, started_at, ended_at)
  select r.id, uid, r.task_id, r.started_at, r.ended_at
  from jsonb_populate_recordset(null::time_entries, coalesce(p->'time_entries','[]')) r
  where exists (select 1 from tasks where id = r.task_id and user_id = uid)
  on conflict (id) do nothing;

  insert into task_dependencies (task_id, depends_on_id, user_id)
  select r.task_id, r.depends_on_id, uid
  from jsonb_populate_recordset(null::task_dependencies, coalesce(p->'task_dependencies','[]')) r
  where exists (select 1 from tasks where id = r.task_id and user_id = uid)
    and exists (select 1 from tasks where id = r.depends_on_id and user_id = uid)
  on conflict do nothing;

  insert into task_templates (id, user_id, name, items)
  select r.id, uid, r.name, coalesce(r.items,'[]')
  from jsonb_populate_recordset(null::task_templates, coalesce(p->'task_templates','[]')) r
  on conflict (id) do nothing;

  insert into saved_views (id, user_id, name, page, filters, created_at)
  select r.id, uid, r.name, r.page, coalesce(r.filters,'{}'), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::saved_views, coalesce(p->'saved_views','[]')) r
  on conflict (id) do nothing;

  insert into automations (id, user_id, topic_id, name, trigger, action, is_enabled, created_at)
  select r.id, uid, r.topic_id, coalesce(r.name,''), r.trigger, r.action, coalesce(r.is_enabled,true),
         coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::automations, coalesce(p->'automations','[]')) r
  where exists (select 1 from topics where id = r.topic_id and user_id = uid)
  on conflict (id) do nothing;

  insert into habits (id, user_id, name, color, icon, frequency, target_per_week, position, is_archived, created_at)
  select r.id, uid, r.name, coalesce(r.color,'#00C875'), r.icon, coalesce(r.frequency,'daily'),
         coalesce(r.target_per_week,3), coalesce(r.position,0), coalesce(r.is_archived,false),
         coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::habits, coalesce(p->'habits','[]')) r
  on conflict (id) do nothing;

  insert into habit_logs (habit_id, date, user_id)
  select r.habit_id, r.date, uid
  from jsonb_populate_recordset(null::habit_logs, coalesce(p->'habit_logs','[]')) r
  where exists (select 1 from habits where id = r.habit_id and user_id = uid)
  on conflict do nothing;

  insert into topic_notes (id, user_id, topic_id, title, content_md, position, updated_at)
  select r.id, uid, r.topic_id, coalesce(r.title,'דף'), coalesce(r.content_md,''),
         coalesce(r.position,0), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::topic_notes, coalesce(p->'topic_notes','[]')) r
  where exists (select 1 from topics where id = r.topic_id and user_id = uid)
  on conflict (id) do nothing;

  insert into documents (id, user_id, topic_id, task_id, filename, storage_path, mime_type, size, uploaded_at)
  select r.id, uid, r.topic_id, r.task_id, r.filename, r.storage_path,
         coalesce(r.mime_type,'application/octet-stream'), coalesce(r.size,0), coalesce(r.uploaded_at, now())
  from jsonb_populate_recordset(null::documents, coalesce(p->'documents','[]')) r
  where r.storage_path like uid::text || '/%'
  on conflict (id) do nothing;

  perform set_config('app.importing', '', true);
  return jsonb_build_object('tasks', n_tasks);
end $$;
