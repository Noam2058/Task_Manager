// נרמול קובץ ייצוא מהמערכת הישנה (Python/SQLite) לפורמט שהפונקציה import_data ב-Supabase מקבלת.
// הקוד סלחני בכוונה: מקבל כמה צורות אפשריות (מקונן / שטוח, שמות שדות ישנים וחדשים).

type Obj = Record<string, any>;

const STATUSES = ['todo', 'in_progress', 'bugfix', 'stuck', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const PLAN = ['none', 'day', 'week', 'month'];

const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const str = (v: unknown, max = 10000): string | null =>
  v === null || v === undefined || v === '' ? null : String(v).slice(0, max);
const date = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const time = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
const ts = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const bool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true';
const num = (v: unknown, def = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const color = (v: unknown, def: string) => {
  const s = str(v);
  return s && /^#[0-9a-fA-F]{6}$/.test(s) ? s : def;
};
const json = (v: unknown, def: any) => {
  if (v && typeof v === 'object') return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { /* ignore */ }
  }
  return def;
};
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
};
const idOf = (v: unknown): string | null =>
  v && typeof v === 'object' ? str((v as Obj).id) : str(v);

export interface NormalizedImport {
  topics: Obj[]; task_groups: Obj[]; goals: Obj[]; sprints: Obj[]; labels: Obj[]; tasks: Obj[];
  task_labels: Obj[]; checklist_items: Obj[]; time_entries: Obj[]; task_dependencies: Obj[];
  task_templates: Obj[]; saved_views: Obj[]; automations: Obj[]; habits: Obj[]; habit_logs: Obj[];
  topic_notes: Obj[]; documents: Obj[];
}

export interface LegacyDocument {
  id: string; topic_id: string | null; task_id: string | null; filename: string; stored_name: string;
  mime_type: string; size: number; uploaded_at: string | null;
}

export interface ImportSummary {
  data: NormalizedImport;
  legacyDocuments: LegacyDocument[];
  counts: Record<string, number>;
  warnings: string[];
}

export function normalizeLegacy(raw: unknown, extraDocuments?: unknown): ImportSummary {
  let src: Obj = (raw && typeof raw === 'object' ? raw : {}) as Obj;
  if (src.data && typeof src.data === 'object' && !Array.isArray(src.data) && !src.tasks) src = src.data;
  const warnings: string[] = [];

  // ---------- נושאים וקבוצות ----------
  const topics = arr(src.topics).map((t, i) => ({
    id: str(t.id)!, name: str(t.name, 120) ?? 'נושא', color: color(t.color, '#579BFC'),
    icon: str(t.icon), position: num(t.position, i), is_archived: bool(t.is_archived),
    created_at: ts(t.created_at),
  })).filter((t) => t.id);
  const topicIds = new Set(topics.map((t) => t.id));

  const rawGroups: Obj[] = [
    ...arr(pick(src, 'groups', 'task_groups')),
    ...arr(src.topics).flatMap((t) => arr(t.groups).map((g) => ({ topic_id: t.id, ...g }))),
  ];
  const seenG = new Set<string>();
  const task_groups = rawGroups.map((g, i) => ({
    id: str(g.id)!, topic_id: str(g.topic_id)!, name: str(g.name, 120) ?? 'כללי',
    color: color(g.color, '#A25DDC'), position: num(g.position, i), is_collapsed: bool(g.is_collapsed),
  })).filter((g) => g.id && topicIds.has(g.topic_id) && !seenG.has(g.id) && seenG.add(g.id));
  const groupIds = new Set(task_groups.map((g) => g.id));

  // ---------- מטרות, ספרינטים, תוויות ----------
  const goals = arr(src.goals).map((g, i) => ({
    id: str(g.id)!, title: str(pick(g, 'title', 'name'), 200) ?? 'מטרה', description: str(g.description) ?? '',
    period: g.period === 'year' ? 'year' : 'quarter', target_date: date(g.target_date),
    color: color(g.color, '#00C875'), position: num(g.position, i), created_at: ts(g.created_at),
  })).filter((g) => g.id);
  const goalIds = new Set(goals.map((g) => g.id));

  const sprints = arr(src.sprints).map((s, i) => {
    let start = date(s.start_date);
    let end = date(s.end_date);
    if (start && end && end < start) [start, end] = [end, start];
    return {
      id: str(s.id)!, name: str(s.name, 120) ?? 'ספרינט', color: color(s.color, '#00C875'),
      start_date: start, end_date: end,
      topic_id: topicIds.has(s.topic_id) ? s.topic_id : null, goal_id: goalIds.has(s.goal_id) ? s.goal_id : null,
      position: num(s.position, i), created_at: ts(s.created_at),
    };
  }).filter((s) => s.id);
  const sprintIds = new Set(sprints.map((s) => s.id));

  const labels = arr(src.labels).map((l) => ({
    id: str(l.id)!, name: str(l.name, 60) ?? 'תווית', color: color(l.color, '#579BFC'),
  })).filter((l) => l.id);
  const labelIds = new Set(labels.map((l) => l.id));

  // ---------- משימות ----------
  const rawTasks = arr(src.tasks);
  const taskIds = new Set(rawTasks.map((t) => str(t.id)).filter(Boolean) as string[]);
  const task_labels: Obj[] = [];
  const checklist_items: Obj[] = [];
  const time_entries: Obj[] = [];
  const task_dependencies: Obj[] = [];

  const tasks = rawTasks.map((t, i) => {
    const id = str(t.id)!;
    const topic = topicIds.has(t.topic_id) ? t.topic_id : null;
    let group = groupIds.has(t.group_id) ? t.group_id : null;
    if (group && topic && task_groups.find((g) => g.id === group)!.topic_id !== topic) group = null;
    const status = STATUSES.includes(t.status) ? t.status : 'todo';

    for (const l of arr(t.labels).concat((Array.isArray(t.labels) ? t.labels : []).filter((x: unknown) => typeof x === 'string').map((x: string) => ({ id: x }))))
      if (labelIds.has(idOf(l)!)) task_labels.push({ task_id: id, label_id: idOf(l) });
    for (const l of Array.isArray(t.label_ids) ? t.label_ids : [])
      if (labelIds.has(l)) task_labels.push({ task_id: id, label_id: l });
    arr(t.checklist).forEach((c, j) => checklist_items.push({
      id: str(c.id) ?? `${id.slice(0, 12)}c${j}`, task_id: id, text: str(c.text, 500) ?? '—',
      is_done: bool(c.is_done), position: num(c.position, j),
    }));
    for (const d of Array.isArray(t.depends_on) ? t.depends_on : [])
      if (taskIds.has(idOf(d)!)) task_dependencies.push({ task_id: id, depends_on_id: idOf(d) });
    arr(t.time_entries).forEach((e) => time_entries.push({ id: str(e.id), task_id: id, started_at: ts(e.started_at), ended_at: ts(e.ended_at) }));

    return {
      id, topic_id: topic, group_id: group,
      parent_id: taskIds.has(t.parent_id) && t.parent_id !== id ? t.parent_id : null,
      title: str(t.title, 500) ?? 'ללא כותרת', description: str(t.description, 20000) ?? '',
      status, priority: PRIORITIES.includes(t.priority) ? t.priority : 'medium',
      due_date: date(t.due_date), due_time: time(t.due_time), start_date: date(t.start_date),
      plan_period: PLAN.includes(t.plan_period) ? t.plan_period : 'none', plan_anchor: date(t.plan_anchor),
      estimate_minutes: t.estimate_minutes == null ? null : Math.min(100000, Math.max(0, Math.round(num(t.estimate_minutes)))),
      recurrence_rule: str(t.recurrence_rule, 200),
      recurrence_parent_id: taskIds.has(t.recurrence_parent_id) ? t.recurrence_parent_id : null,
      sprint_id: sprintIds.has(t.sprint_id) ? t.sprint_id : null,
      goal_id: goalIds.has(t.goal_id) ? t.goal_id : null,
      color: t.color ? color(t.color, '#579BFC') : null,
      position: num(t.position, i),
      completed_at: status === 'done' ? ts(t.completed_at) ?? ts(t.updated_at) : null,
      is_archived: bool(t.is_archived), created_at: ts(t.created_at), updated_at: ts(t.updated_at),
    };
  }).filter((t) => t.id);

  // רשימות שטוחות (אם הייצוא שמר אותן בנפרד)
  for (const c of arr(pick(src, 'checklist_items', 'checklist')))
    if (taskIds.has(c.task_id) && !checklist_items.some((x) => x.id === c.id))
      checklist_items.push({ id: str(c.id), task_id: c.task_id, text: str(c.text, 500) ?? '—', is_done: bool(c.is_done), position: num(c.position) });
  for (const tl of arr(src.task_labels))
    if (taskIds.has(tl.task_id) && labelIds.has(tl.label_id)) task_labels.push({ task_id: tl.task_id, label_id: tl.label_id });
  for (const e of arr(src.time_entries))
    if (taskIds.has(e.task_id) && !time_entries.some((x) => x.id === e.id))
      time_entries.push({ id: str(e.id), task_id: e.task_id, started_at: ts(e.started_at), ended_at: ts(e.ended_at) });
  for (const d of arr(pick(src, 'task_dependencies', 'dependencies')))
    if (taskIds.has(d.task_id) && taskIds.has(d.depends_on_id) && d.task_id !== d.depends_on_id)
      task_dependencies.push({ task_id: d.task_id, depends_on_id: d.depends_on_id });

  const dedupe = (list: Obj[], key: (o: Obj) => string) => {
    const seen = new Set<string>();
    return list.filter((o) => { const k = key(o); if (seen.has(k)) return false; seen.add(k); return true; });
  };

  // ---------- שאר הישויות ----------
  const task_templates = arr(pick(src, 'templates', 'task_templates')).map((t) => ({
    id: str(t.id)!, name: str(t.name, 120) ?? 'תבנית', items: json(t.items, []),
  })).filter((t) => t.id);

  const saved_views = arr(pick(src, 'views', 'saved_views')).map((v) => ({
    id: str(v.id)!, name: str(v.name, 120) ?? 'תצוגה', page: str(v.page) ?? 'dashboard',
    filters: json(pick(v, 'filters', 'filters_json'), {}), created_at: ts(v.created_at),
  })).filter((v) => v.id);

  const automations = arr(src.automations).map((a) => ({
    id: str(a.id)!, topic_id: a.topic_id, name: str(a.name, 200) ?? '',
    trigger: json(pick(a, 'trigger', 'trigger_json'), null), action: json(pick(a, 'action', 'action_json'), null),
    is_enabled: a.is_enabled === undefined ? true : bool(a.is_enabled), created_at: ts(a.created_at),
  })).filter((a) => a.id && topicIds.has(a.topic_id) && a.trigger && a.action);

  const habits = arr(src.habits).map((h, i) => ({
    id: str(h.id)!, name: str(h.name, 120) ?? 'הרגל', color: color(h.color, '#00C875'), icon: str(h.icon),
    frequency: h.frequency === 'weekly' ? 'weekly' : 'daily',
    target_per_week: Math.min(7, Math.max(1, Math.round(num(h.target_per_week, 3)))),
    position: num(h.position, i), is_archived: bool(h.is_archived), created_at: ts(h.created_at),
  })).filter((h) => h.id);
  const habitIds = new Set(habits.map((h) => h.id));
  const habit_logs = dedupe([
    ...arr(src.habits).flatMap((h) => (Array.isArray(pick(h, 'logs', 'dates', 'log_dates')) ? pick(h, 'logs', 'dates', 'log_dates') : [])
      .map((d: unknown) => ({ habit_id: h.id, date: date(typeof d === 'object' && d ? (d as Obj).date : d) }))),
    ...arr(pick(src, 'habit_logs', 'habitLogs')).map((l) => ({ habit_id: l.habit_id, date: date(l.date) })),
  ].filter((l) => habitIds.has(l.habit_id) && l.date), (l) => `${l.habit_id}|${l.date}`);

  const topic_notes = ([
    ...arr(pick(src, 'notes', 'topic_notes')),
    ...arr(src.topics).flatMap((t) => arr(t.notes).map((n) => ({ topic_id: t.id, ...n }))),
  ] as Obj[]).map((n, i) => ({
    id: str(n.id)!, topic_id: n.topic_id, title: str(n.title, 200) ?? 'דף',
    content_md: str(pick(n, 'content_md', 'content'), 200000) ?? '', position: num(n.position, i),
    updated_at: ts(n.updated_at),
  })).filter((n) => n.id && topicIds.has(n.topic_id));

  const legacyDocuments: LegacyDocument[] = dedupe(
    [...arr(src.documents), ...arr(extraDocuments)].filter((d) => str(d.stored_name)), (d) => String(d.id ?? d.stored_name),
  ).map((d) => ({
    id: str(d.id) ?? str(d.stored_name)!.replace(/\W/g, '').slice(0, 20), topic_id: topicIds.has(d.topic_id) ? d.topic_id : null,
    task_id: taskIds.has(d.task_id) ? d.task_id : null, filename: str(d.filename, 255) ?? str(d.stored_name)!,
    stored_name: str(d.stored_name)!, mime_type: str(d.mime_type) ?? 'application/octet-stream',
    size: num(d.size), uploaded_at: ts(d.uploaded_at),
  }));

  if (!rawTasks.length) warnings.push('לא נמצאו משימות בקובץ');
  const orphanTopics = rawTasks.filter((t) => t.topic_id && !topicIds.has(t.topic_id)).length;
  if (orphanTopics) warnings.push(`${orphanTopics} משימות הפנו לנושא שלא קיים — יובאו בלי נושא`);

  const data: NormalizedImport = {
    topics, task_groups, goals, sprints, labels, tasks,
    task_labels: dedupe(task_labels, (o) => `${o.task_id}|${o.label_id}`),
    checklist_items: dedupe(checklist_items.filter((c) => c.id), (o) => o.id),
    time_entries: dedupe(time_entries.filter((e) => e.id && e.started_at), (o) => o.id),
    task_dependencies: dedupe(task_dependencies, (o) => `${o.task_id}|${o.depends_on_id}`),
    task_templates, saved_views, automations, habits, habit_logs, topic_notes, documents: [],
  };
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  counts.documents = legacyDocuments.length;
  return { data, legacyDocuments, counts, warnings };
}

export const IMPORT_LABELS: Record<string, string> = {
  topics: 'נושאים', task_groups: 'קבוצות', tasks: 'משימות', labels: 'תוויות', sprints: 'ספרינטים',
  goals: 'מטרות', habits: 'הרגלים', topic_notes: 'דפי הערות', automations: 'אוטומציות', documents: 'מסמכים',
  checklist_items: 'פריטי צ׳קליסט',
};
