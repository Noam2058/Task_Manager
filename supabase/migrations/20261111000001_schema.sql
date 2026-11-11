-- =====================================================================
-- ניהול משימות — גרסה פרטית על Supabase
-- 0001: סכמה, RLS, טריגרים (חזרתיות, תלויות, אוטומציות, יומן פעילות)
-- =====================================================================

-- ---------- עזרים ----------
create or replace function public.new_id() returns text
language sql volatile as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)
$$;

create or replace function public.today_il() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Jerusalem')::date
$$;

-- ---------- פרופיל והגדרות ----------
create table public.profiles (
  user_id      uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  settings     jsonb not null default '{}'::jsonb,
  last_morning_push date,
  created_at   timestamptz not null default now()
);

-- ---------- מרחבי עבודה (עבודה / אישי) ----------
create table public.workspaces (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null check (length(name) between 1 and 80),
  color      text not null default '#5B5FEF',
  icon       text,
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.topics (
  id           text primary key default public.new_id(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id text not null references public.workspaces on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  color        text not null default '#579BFC',
  icon         text,
  position     double precision not null default 0,
  is_archived  boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.task_groups (
  id           text primary key default public.new_id(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id     text not null references public.topics on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  color        text not null default '#A25DDC',
  position     double precision not null default 0,
  is_collapsed boolean not null default false
);

create table public.goals (
  id           text primary key default public.new_id(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id text references public.workspaces on delete cascade,
  title        text not null check (length(title) between 1 and 200),
  description  text not null default '',
  period       text not null default 'quarter' check (period in ('quarter','year')),
  target_date  date,
  color        text not null default '#00C875',
  position     double precision not null default 0,
  created_at   timestamptz not null default now()
);

create table public.sprints (
  id           text primary key default public.new_id(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id text references public.workspaces on delete cascade,
  name         text not null check (length(name) between 1 and 120),
  color        text not null default '#00C875',
  start_date   date,
  end_date     date,
  topic_id     text references public.topics on delete set null,
  goal_id      text references public.goals on delete set null,
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.tasks (
  id                   text primary key default public.new_id(),
  user_id              uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id         text references public.workspaces on delete cascade,
  topic_id             text references public.topics on delete set null,
  group_id             text references public.task_groups on delete set null,
  parent_id            text references public.tasks on delete cascade,
  title                text not null check (length(title) between 1 and 500),
  description          text not null default '' check (length(description) <= 20000),
  status               text not null default 'todo'
                       check (status in ('todo','in_progress','bugfix','stuck','done')),
  priority             text not null default 'medium'
                       check (priority in ('low','medium','high','critical')),
  due_date             date,
  due_time             text check (due_time is null or due_time ~ '^\d{2}:\d{2}$'),
  start_date           date,
  plan_period          text not null default 'none' check (plan_period in ('none','day','week','month')),
  plan_anchor          date,
  estimate_minutes     integer check (estimate_minutes between 0 and 100000),
  recurrence_rule      text,
  recurrence_parent_id text references public.tasks on delete set null,
  sprint_id            text references public.sprints on delete set null,
  goal_id              text references public.goals on delete set null,
  color                text,
  remind_before_min    integer not null default 0 check (remind_before_min between 0 and 10080),
  reminded_key         text,
  position             double precision not null default 0,
  completed_at         timestamptz,
  is_archived          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.labels (
  id      text primary key default public.new_id(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name    text not null check (length(name) between 1 and 60),
  color   text not null default '#579BFC'
);

create table public.task_labels (
  task_id  text not null references public.tasks on delete cascade,
  label_id text not null references public.labels on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (task_id, label_id)
);

create table public.checklist_items (
  id       text primary key default public.new_id(),
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  task_id  text not null references public.tasks on delete cascade,
  text     text not null check (length(text) between 1 and 500),
  is_done  boolean not null default false,
  position double precision not null default 0
);

create table public.time_entries (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  task_id    text not null references public.tasks on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz
);

create table public.activity_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  task_id    text not null references public.tasks on delete cascade,
  action     text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.task_templates (
  id      text primary key default public.new_id(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name    text not null,
  items   jsonb not null default '[]'::jsonb
);

create table public.documents (
  id           text primary key default public.new_id(),
  user_id      uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id     text references public.topics on delete cascade,
  task_id      text references public.tasks on delete set null,
  filename     text not null,
  storage_path text not null unique,
  mime_type    text not null default 'application/octet-stream',
  size         bigint not null default 0,
  uploaded_at  timestamptz not null default now()
);

create table public.saved_views (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  page       text not null,
  filters    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.automations (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id   text not null references public.topics on delete cascade,
  name       text not null default '',
  trigger    jsonb not null,
  action     jsonb not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.automation_runs (
  automation_id text not null references public.automations on delete cascade,
  task_id       text not null references public.tasks on delete cascade,
  run_date      date not null,
  user_id       uuid not null references auth.users on delete cascade,
  primary key (automation_id, task_id, run_date)
);

create table public.task_dependencies (
  task_id       text not null references public.tasks on delete cascade,
  depends_on_id text not null references public.tasks on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table public.habits (
  id              text primary key default public.new_id(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  name            text not null check (length(name) between 1 and 120),
  color           text not null default '#00C875',
  icon            text,
  frequency       text not null default 'daily' check (frequency in ('daily','weekly')),
  target_per_week integer not null default 3 check (target_per_week between 1 and 7),
  position        double precision not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.habit_logs (
  habit_id text not null references public.habits on delete cascade,
  date     date not null,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (habit_id, date)
);

create table public.topic_notes (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  topic_id   text not null references public.topics on delete cascade,
  title      text not null default 'דף חדש',
  content_md text not null default '',
  position   double precision not null default 0,
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id         text primary key default public.new_id(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- ---------- אינדקסים ----------
create index on public.tasks (user_id, is_archived);
create index on public.tasks (due_date);
create index on public.tasks (topic_id);
create index on public.tasks (group_id);
create index on public.tasks (parent_id);
create index on public.tasks (sprint_id);
create index on public.tasks (workspace_id);
create index on public.tasks (recurrence_parent_id);
create index on public.topics (workspace_id);
create index on public.task_groups (topic_id);
create index on public.checklist_items (task_id);
create index on public.task_labels (label_id);
create index on public.time_entries (task_id);
create index on public.activity_log (task_id, created_at desc);
create index on public.documents (topic_id);
create index on public.task_dependencies (depends_on_id);
create index on public.topic_notes (topic_id);

-- ---------- RLS: כל משתמש רואה רק את שלו ----------
do $$
declare t text;
begin
  foreach t in array array[
    'workspaces','topics','task_groups','goals','sprints','tasks','labels','task_labels',
    'checklist_items','time_entries','activity_log','task_templates','documents','saved_views',
    'automations','automation_runs','task_dependencies','habits','habit_logs','topic_notes',
    'push_subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- טוקן היומן החיצוני בטבלה נפרדת בלי policies — נגיש רק לפונקציות security definer
create table public.ics_tokens (
  user_id uuid primary key references auth.users on delete cascade,
  token   text not null unique
);
alter table public.ics_tokens enable row level security;

-- =====================================================================
-- חזרתיות
-- =====================================================================
create or replace function public.rrule_part(rule text, key text) returns text
language sql immutable as $$
  select substring(';' || upper(rule) || ';' from ';' || key || '=([^;]*);')
$$;

create or replace function public.next_occurrence(rule text, base date) returns date
language plpgsql immutable as $$
declare
  freq text := public.rrule_part(rule, 'FREQ');
  iv   int  := greatest(coalesce(nullif(public.rrule_part(rule, 'INTERVAL'), '')::int, 1), 1);
  byday text := public.rrule_part(rule, 'BYDAY');
  bymd int := nullif(public.rrule_part(rule, 'BYMONTHDAY'), '')::int;
  days int[];
  dow int := extract(dow from base)::int;   -- 0 = ראשון
  d int;
  m date;
begin
  if freq = 'DAILY' then
    return base + iv;
  elsif freq = 'WEEKLY' then
    if byday is null or byday = '' then
      return base + 7 * iv;
    end if;
    select array_agg(x order by x) into days from (
      select array_position(array['SU','MO','TU','WE','TH','FR','SA'], trim(p)) - 1 as x
      from unnest(string_to_array(byday, ',')) p
    ) s where x is not null;
    if days is null then return base + 7 * iv; end if;
    foreach d in array days loop
      if d > dow then return base + (d - dow); end if;
    end loop;
    return base - dow + 7 * iv + days[1];
  elsif freq = 'MONTHLY' then
    if bymd is null then
      return (base + make_interval(months => iv))::date;
    end if;
    m := date_trunc('month', base)::date;
    if extract(day from base) < bymd then
      return least(m + (bymd - 1), (m + interval '1 month - 1 day')::date);
    end if;
    m := (m + make_interval(months => iv))::date;
    return least(m + (bymd - 1), (m + interval '1 month - 1 day')::date);
  elsif freq = 'YEARLY' then
    return (base + make_interval(years => iv))::date;
  end if;
  return null;
end $$;

create or replace function public.spawn_recurrence(t public.tasks) returns text
language plpgsql security definer set search_path = public as $$
declare
  base date := coalesce(t.due_date, public.today_il());
  nxt  date := public.next_occurrence(t.recurrence_rule, base);
  root text := coalesce(t.recurrence_parent_id, t.id);
  new_id text;
begin
  if nxt is null then return null; end if;
  -- לא ליצור כפילות אם המופע הבא כבר קיים (השלמה → פתיחה → השלמה)
  if exists (select 1 from tasks where (recurrence_parent_id = root or id = root)
             and due_date = nxt and id <> t.id) then
    return null;
  end if;
  insert into tasks (user_id, workspace_id, topic_id, group_id, parent_id, title, description,
                     status, priority, due_date, due_time, start_date, estimate_minutes,
                     recurrence_rule, recurrence_parent_id, sprint_id, goal_id, color,
                     remind_before_min, position)
  values (t.user_id, t.workspace_id, t.topic_id, t.group_id, t.parent_id, t.title, t.description,
          'todo', t.priority, nxt, t.due_time,
          case when t.start_date is not null and t.due_date is not null
               then t.start_date + (nxt - t.due_date) end,
          t.estimate_minutes, t.recurrence_rule, root, t.sprint_id, t.goal_id, t.color,
          t.remind_before_min, t.position)
  returning id into new_id;

  insert into task_labels (task_id, label_id, user_id)
    select new_id, label_id, t.user_id from task_labels where task_id = t.id;
  insert into checklist_items (user_id, task_id, text, is_done, position)
    select t.user_id, new_id, text, false, position from checklist_items where task_id = t.id;
  return new_id;
end $$;

-- =====================================================================
-- אוטומציות
-- trigger: {"type":"status_changed","to":"done"} | {"type":"task_created","group_id":null}
--          {"type":"due_date"} | {"type":"checklist_done"}
-- action:  {"type":"move_group","group_id"} | {"type":"set_status","status"}
--          {"type":"set_priority","priority"} | {"type":"add_label","label_id"}
--          {"type":"set_sprint","sprint_id"} | {"type":"apply_template","template_id"}
-- =====================================================================
create or replace function public.apply_automation_action(a public.automations, t public.tasks)
returns void language plpgsql security definer set search_path = public as $$
declare
  act text := a.action->>'type';
  item jsonb;
  i int := 0;
begin
  if act = 'move_group' then
    update tasks set group_id = a.action->>'group_id' where id = t.id;
  elsif act = 'set_status' then
    update tasks set status = a.action->>'status' where id = t.id;
  elsif act = 'set_priority' then
    update tasks set priority = a.action->>'priority' where id = t.id;
  elsif act = 'add_label' then
    insert into task_labels (task_id, label_id, user_id)
      values (t.id, a.action->>'label_id', t.user_id) on conflict do nothing;
  elsif act = 'set_sprint' then
    update tasks set sprint_id = a.action->>'sprint_id' where id = t.id;
  elsif act = 'apply_template' then
    for item in select * from jsonb_array_elements(
      coalesce((select items from task_templates where id = a.action->>'template_id'), '[]'))
    loop
      i := i + 1;
      insert into tasks (user_id, workspace_id, topic_id, group_id, parent_id, title, position)
      values (t.user_id, t.workspace_id, t.topic_id, t.group_id, t.id,
              left(coalesce(item->>'title', item #>> '{}'), 500), i);
    end loop;
  end if;
  insert into activity_log (user_id, task_id, action, payload)
    values (t.user_id, t.id, 'automation', jsonb_build_object('name', a.name, 'action', act));
end $$;

create or replace function public.run_automations(evt text, t public.tasks, to_status text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.automations;
begin
  if coalesce(current_setting('app.in_automation', true), '') = '1'
     or coalesce(current_setting('app.importing', true), '') = '1'
     or t.topic_id is null then
    return;
  end if;
  perform set_config('app.in_automation', '1', true);
  for a in select * from automations
           where topic_id = t.topic_id and is_enabled and trigger->>'type' = evt
           order by created_at loop
    if evt = 'status_changed' and coalesce(a.trigger->>'to', '') <> coalesce(to_status, '') then
      continue;
    end if;
    if evt = 'task_created' and coalesce(a.trigger->>'group_id', '') <> ''
       and a.trigger->>'group_id' is distinct from t.group_id then
      continue;
    end if;
    begin
      perform public.apply_automation_action(a, t);
    exception when others then
      raise warning 'automation % failed: %', a.id, sqlerrm;
    end;
  end loop;
  perform set_config('app.in_automation', '', true);
end $$;

-- נקרא מ-pg_cron כל 10 דקות
create or replace function public.run_due_date_automations() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  perform set_config('app.in_automation', '1', true);
  for r in
    select a as auto, t as task from automations a
    join tasks t on t.topic_id = a.topic_id
    where a.is_enabled and a.trigger->>'type' = 'due_date'
      and t.due_date = public.today_il() and t.status <> 'done' and not t.is_archived
      and not exists (select 1 from automation_runs ar where ar.automation_id = a.id
                      and ar.task_id = t.id and ar.run_date = public.today_il())
  loop
    insert into automation_runs values ((r.auto).id, (r.task).id, public.today_il(), (r.task).user_id);
    begin
      perform public.apply_automation_action(r.auto, r.task);
      n := n + 1;
    exception when others then
      raise warning 'due automation failed: %', sqlerrm;
    end;
  end loop;
  perform set_config('app.in_automation', '', true);
  return n;
end $$;

-- =====================================================================
-- טריגרים על משימות
-- =====================================================================
create or replace function public.tasks_before() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.group_id is not null and new.topic_id is null then
    select topic_id into new.topic_id from task_groups where id = new.group_id;
  end if;
  if new.topic_id is not null and (tg_op = 'INSERT' or new.topic_id is distinct from old.topic_id) then
    select workspace_id into new.workspace_id from topics where id = new.topic_id;
    if new.group_id is not null and not exists
       (select 1 from task_groups where id = new.group_id and topic_id = new.topic_id) then
      new.group_id := null;
    end if;
  end if;
  if new.workspace_id is null and new.parent_id is not null then
    select workspace_id into new.workspace_id from tasks where id = new.parent_id;
  end if;
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  -- שינוי תאריך/שעה מאפס את התזכורת
  if tg_op = 'UPDATE' and (new.due_date is distinct from old.due_date
                           or new.due_time is distinct from old.due_time) then
    new.reminded_key := null;
  end if;
  return new;
end $$;

create trigger tasks_before before insert or update on public.tasks
  for each row execute function public.tasks_before();

create or replace function public.tasks_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare f text; ov text; nv text;
begin
  if coalesce(current_setting('app.importing', true), '') = '1' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    insert into activity_log (user_id, task_id, action) values (new.user_id, new.id, 'created');
    perform public.run_automations('task_created', new);
    return null;
  end if;

  foreach f in array array['status','priority','due_date','title','topic_id','sprint_id','start_date'] loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f) into ov, nv using old, new;
    if ov is distinct from nv then
      insert into activity_log (user_id, task_id, action, payload)
        values (new.user_id, new.id, 'changed', jsonb_build_object('field', f, 'from', ov, 'to', nv));
    end if;
  end loop;

  if new.status is distinct from old.status then
    if new.status = 'done' and new.recurrence_rule is not null and new.recurrence_rule <> '' then
      perform public.spawn_recurrence(new);
    end if;
    perform public.run_automations('status_changed', new, new.status);
  end if;
  return null;
end $$;

create trigger tasks_after after insert or update on public.tasks
  for each row execute function public.tasks_after();

-- צ'קליסט הושלם במלואו
create or replace function public.checklist_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  if coalesce(current_setting('app.importing', true), '') = '1' then return null; end if;
  if new.is_done and not old.is_done
     and not exists (select 1 from checklist_items where task_id = new.task_id and not is_done) then
    select * into t from tasks where id = new.task_id;
    perform public.run_automations('checklist_done', t);
  end if;
  return null;
end $$;

create trigger checklist_after after update on public.checklist_items
  for each row execute function public.checklist_after();

-- הערות: updated_at
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create trigger notes_touch before update on public.topic_notes
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- תלויות — מניעת מעגל
-- =====================================================================
create or replace function public.deps_no_cycle() returns trigger
language plpgsql as $$
begin
  if exists (
    with recursive chain(id) as (
      select depends_on_id from task_dependencies where task_id = new.depends_on_id
      union
      select d.depends_on_id from task_dependencies d join chain c on d.task_id = c.id
    )
    select 1 from chain where id = new.task_id
  ) or new.depends_on_id = new.task_id then
    raise exception 'DEPENDENCY_CYCLE' using errcode = 'P0001',
      hint = 'התלות הזו יוצרת מעגל';
  end if;
  return new;
end $$;

create trigger deps_no_cycle before insert or update on public.task_dependencies
  for each row execute function public.deps_no_cycle();

-- =====================================================================
-- טיימר: טיימר פעיל אחד בלבד
-- =====================================================================
create or replace function public.timer_start(p_task text) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
  insert into time_entries (task_id) values (p_task);
end $$;

create or replace function public.timer_stop() returns void
language plpgsql security invoker set search_path = public as $$
begin
  update time_entries set ended_at = now() where user_id = auth.uid() and ended_at is null;
end $$;

-- =====================================================================
-- סידור מחדש (גרירה)
-- =====================================================================
create or replace function public.reorder(p_table text, p_ids text[],
                                          p_group text default null, p_topic text default null,
                                          p_set_group boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_table not in ('tasks','topics','task_groups','sprints','habits','workspaces','goals',
                     'checklist_items','topic_notes') then
    raise exception 'bad table';
  end if;
  if p_table = 'tasks' and p_set_group then
    update tasks t set position = x.ord, group_id = p_group,
                       topic_id = coalesce(p_topic, t.topic_id)
      from unnest(p_ids) with ordinality as x(id, ord) where t.id = x.id;
  else
    execute format('update %I t set position = x.ord
                    from unnest($1) with ordinality as x(id, ord) where t.id = x.id', p_table)
      using p_ids;
  end if;
end $$;

-- =====================================================================
-- טוקן ליומן חיצוני
-- =====================================================================
create or replace function public.ics_token_rotate() returns text
language plpgsql security definer set search_path = public as $$
declare tok text := encode(sha256(gen_random_uuid()::text::bytea || clock_timestamp()::text::bytea), 'hex');
begin
  insert into ics_tokens (user_id, token) values (auth.uid(), tok)
    on conflict (user_id) do update set token = excluded.token;
  return tok;
end $$;

create or replace function public.ics_token_get() returns text
language sql security definer set search_path = public as $$
  select token from ics_tokens where user_id = auth.uid()
$$;

create or replace function public.ics_token_revoke() returns void
language sql security definer set search_path = public as $$
  delete from ics_tokens where user_id = auth.uid()
$$;

-- =====================================================================
-- משתמש חדש: פרופיל + שני מרחבים + נושאים בסיסיים
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare w_work text; w_home text; t1 text; t2 text;
begin
  insert into profiles (user_id, display_name, settings)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
          jsonb_build_object('shabbat_city','חיפה','shabbat_lat',32.794,'shabbat_lon',34.9896,
                             'shabbat_candle_minutes',30,'daily_summary_hour',18,
                             'workday_minutes',480,'morning_push_hour',8));
  insert into workspaces (user_id, name, color, icon, position)
    values (new.id, 'עבודה', '#579BFC', 'briefcase', 1) returning id into w_work;
  insert into workspaces (user_id, name, color, icon, position)
    values (new.id, 'אישי', '#A25DDC', 'home', 2) returning id into w_home;
  insert into topics (user_id, workspace_id, name, color, icon, position)
    values (new.id, w_work, 'כללי', '#579BFC', 'briefcase', 1) returning id into t1;
  insert into topics (user_id, workspace_id, name, color, icon, position)
    values (new.id, w_home, 'בית', '#A25DDC', 'home', 1) returning id into t2;
  insert into task_groups (user_id, topic_id, name, position) values (new.id, t1, 'כללי', 1), (new.id, t2, 'כללי', 1);
  insert into labels (user_id, name, color) values (new.id, 'דחוף', '#E2445C'), (new.id, 'מעקב', '#FDAB3D');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- פונקציות פנימיות (security definer) — לא נגישות דרך ה-API
-- =====================================================================
revoke execute on function public.spawn_recurrence(public.tasks) from public, anon, authenticated;
revoke execute on function public.apply_automation_action(public.automations, public.tasks) from public, anon, authenticated;
revoke execute on function public.run_automations(text, public.tasks, text) from public, anon, authenticated;
revoke execute on function public.run_due_date_automations() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
