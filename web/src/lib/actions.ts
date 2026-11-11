// כל הפעולות שמשנות נתונים: עדכון אופטימי מיידי של ה-cache + שליחה דרך ה-outbox.
import { toast } from 'sonner';
import type { ChecklistItem, Priority, Status, TaskRow } from '@/types';
import { exec, getRaw, patchList, patchRaw, type Op, type RawState } from './db';
import { newId, nowIso } from './utils';
import { addDays, today } from './dates';
import { useUI } from '@/store/useUIStore';

const UNDO_MS = 6000;

// ---------------------------------------------------------------- משימות
export type TaskInput = Partial<TaskRow> & { title: string; label_ids?: string[] };

const TASK_COLUMNS: (keyof TaskRow)[] = [
  'id', 'workspace_id', 'topic_id', 'group_id', 'parent_id', 'title', 'description', 'status', 'priority',
  'due_date', 'due_time', 'start_date', 'plan_period', 'plan_anchor', 'estimate_minutes', 'recurrence_rule',
  'sprint_id', 'goal_id', 'color', 'remind_before_min', 'position', 'is_archived',
];

function nextPosition(raw: RawState, groupId: string | null, topicId: string | null, parentId: string | null) {
  const sib = raw.tasks.filter((t) => t.group_id === groupId && t.topic_id === topicId && t.parent_id === parentId);
  return sib.reduce((m, t) => Math.max(m, t.position), 0) + 1;
}

export function createTask(input: TaskInput, opts: { open?: boolean } = {}): string {
  const raw = getRaw();
  const id = input.id ?? newId();
  let topicId = input.topic_id ?? null;
  let groupId = input.group_id ?? null;
  let workspaceId = input.workspace_id ?? null;
  if (raw) {
    if (groupId && !topicId) topicId = raw.groups.find((g) => g.id === groupId)?.topic_id ?? null;
    if (topicId && !groupId) {
      groupId = raw.groups.filter((g) => g.topic_id === topicId).sort((a, b) => a.position - b.position)[0]?.id ?? null;
    }
    if (topicId) workspaceId = raw.topics.find((t) => t.id === topicId)?.workspace_id ?? workspaceId;
    if (!workspaceId && input.parent_id) workspaceId = raw.tasks.find((t) => t.id === input.parent_id)?.workspace_id ?? null;
    if (!workspaceId) {
      const ws = useUI.getState().activeWorkspace;
      workspaceId = raw.workspaces.some((w) => w.id === ws) ? ws : raw.workspaces[0]?.id ?? null;
    }
  }
  const now = nowIso();
  const row: TaskRow = {
    id, workspace_id: workspaceId, topic_id: topicId, group_id: groupId, parent_id: input.parent_id ?? null,
    title: input.title.trim().slice(0, 500), description: input.description ?? '', status: input.status ?? 'todo',
    priority: input.priority ?? 'medium', due_date: input.due_date ?? null, due_time: input.due_time ?? null,
    start_date: input.start_date ?? null, plan_period: input.plan_period ?? 'none', plan_anchor: input.plan_anchor ?? null,
    estimate_minutes: input.estimate_minutes ?? null, recurrence_rule: input.recurrence_rule ?? null,
    recurrence_parent_id: null, sprint_id: input.sprint_id ?? null, goal_id: input.goal_id ?? null,
    color: input.color ?? null, remind_before_min: input.remind_before_min ?? 0,
    position: input.position ?? (raw ? nextPosition(raw, groupId, topicId, input.parent_id ?? null) : 0),
    completed_at: input.status === 'done' ? now : null, is_archived: false, created_at: now, updated_at: now,
  };
  const labelIds = input.label_ids ?? [];
  patchRaw((s) => ({
    tasks: [...s.tasks, row],
    taskLabels: [...s.taskLabels, ...labelIds.map((l) => ({ task_id: id, label_id: l }))],
  }));
  const dbRow = Object.fromEntries(TASK_COLUMNS.map((k) => [k, row[k]]));
  const ops: Op[] = [{ t: 'insert', table: 'tasks', rows: [dbRow] }];
  if (labelIds.length) ops.push({ t: 'insert', table: 'task_labels', rows: labelIds.map((l) => ({ task_id: id, label_id: l })) });
  void exec(...ops);
  if (opts.open ?? !input.parent_id) useUI.getState().openTask(id);
  return id;
}

export function updateTask(id: string, patch: Partial<TaskRow>) {
  updateTasks([id], patch);
}

export function updateTasks(ids: string[], patch: Partial<TaskRow>) {
  if (!ids.length) return;
  const p: Partial<TaskRow> = { ...patch, updated_at: nowIso() };
  if (patch.status) p.completed_at = patch.status === 'done' ? nowIso() : null;
  if (patch.due_date !== undefined || patch.due_time !== undefined) (p as Record<string, unknown>).reminded_key = null;
  patchRaw((s) => ({ tasks: patchList(s.tasks, ids, p) }));
  const { updated_at, completed_at, ...sent } = p as Record<string, unknown>;
  void updated_at; void completed_at;
  void exec(ids.length === 1
    ? { t: 'update', table: 'tasks', match: { id: ids[0] }, patch: sent }
    : { t: 'updateIn', table: 'tasks', column: 'id', values: ids, patch: sent });
}

/** עדכון עם Undo */
export function updateTasksWithUndo(ids: string[], patch: Partial<TaskRow>, message: string) {
  const raw = getRaw();
  const before = raw?.tasks.filter((t) => ids.includes(t.id)) ?? [];
  updateTasks(ids, patch);
  toast(message, {
    duration: UNDO_MS,
    action: {
      label: 'בטל',
      onClick: () => {
        for (const t of before) {
          const restore: Partial<TaskRow> = {};
          for (const k of Object.keys(patch) as (keyof TaskRow)[]) (restore as Record<string, unknown>)[k] = t[k];
          updateTask(t.id, restore);
        }
      },
    },
  });
}

export function setStatus(id: string, status: Status) {
  const raw = getRaw();
  const t = raw?.tasks.find((x) => x.id === id);
  if (!t || t.status === status) return;
  if (status === 'done' || t.status === 'done') {
    updateTasksWithUndo([id], { status }, status === 'done' ? `"${t.title}" הושלמה` : 'המשימה נפתחה מחדש');
  } else {
    updateTask(id, { status });
  }
}

export async function toggleComplete(id: string) {
  const raw = getRaw();
  const t = raw?.tasks.find((x) => x.id === id);
  if (!t) return;
  if (t.status !== 'done') {
    const blockers = raw!.deps.filter((d) => d.task_id === id)
      .map((d) => raw!.tasks.find((x) => x.id === d.depends_on_id))
      .filter((x) => x && x.status !== 'done');
    if (blockers.length) {
      const { confirmDialog } = await import('@/components/ui/confirm');
      const ok = await confirmDialog({
        title: 'המשימה חסומה',
        description: `יש ${blockers.length} משימות שהיא תלויה בהן ועוד לא הושלמו: ${blockers.map((b) => b!.title).join(', ')}. להשלים בכל זאת?`,
        confirmLabel: 'השלמה',
      });
      if (!ok) return;
    }
  }
  setStatus(id, t.status === 'done' ? 'todo' : 'done');
}

export function postpone(ids: string[], days = 1) {
  const raw = getRaw();
  const base = today();
  for (const id of ids) {
    const t = raw?.tasks.find((x) => x.id === id);
    if (!t) continue;
    const from = t.due_date && t.due_date >= base ? t.due_date : base;
    updateTask(id, { due_date: addDays(from, days) });
  }
}

/** מחיקה עם Undo: נעלמת מיד, נשלחת לשרת רק אחרי 6 שניות */
export function deleteTasks(ids: string[]) {
  const raw = getRaw();
  if (!raw || !ids.length) return;
  const all = new Set(ids);
  // כולל תתי-משימות (cascade בשרת)
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of raw.tasks) if (t.parent_id && all.has(t.parent_id) && !all.has(t.id)) { all.add(t.id); grew = true; }
  }
  const snapshot = {
    tasks: raw.tasks.filter((t) => all.has(t.id)),
    taskLabels: raw.taskLabels.filter((t) => all.has(t.task_id)),
    checklist: raw.checklist.filter((t) => all.has(t.task_id)),
    deps: raw.deps.filter((d) => all.has(d.task_id) || all.has(d.depends_on_id)),
    timeEntries: raw.timeEntries.filter((e) => all.has(e.task_id)),
  };
  patchRaw((s) => ({
    tasks: s.tasks.filter((t) => !all.has(t.id)),
    taskLabels: s.taskLabels.filter((t) => !all.has(t.task_id)),
    checklist: s.checklist.filter((t) => !all.has(t.task_id)),
    deps: s.deps.filter((d) => !all.has(d.task_id) && !all.has(d.depends_on_id)),
  }));
  const ui = useUI.getState();
  if (ui.openTaskId && all.has(ui.openTaskId)) ui.openTask(null);
  let undone = false;
  const timer = setTimeout(() => {
    if (!undone) void exec({ t: 'deleteIn', table: 'tasks', column: 'id', values: ids });
  }, UNDO_MS);
  toast(ids.length === 1 ? `"${snapshot.tasks.find((t) => t.id === ids[0])?.title ?? 'המשימה'}" נמחקה` : `${ids.length} משימות נמחקו`, {
    duration: UNDO_MS,
    action: {
      label: 'בטל',
      onClick: () => {
        undone = true;
        clearTimeout(timer);
        patchRaw((s) => ({
          tasks: [...s.tasks, ...snapshot.tasks],
          taskLabels: [...s.taskLabels, ...snapshot.taskLabels],
          checklist: [...s.checklist, ...snapshot.checklist],
          deps: [...s.deps, ...snapshot.deps],
        }));
      },
    },
  });
}

export function archiveTasks(ids: string[]) {
  updateTasksWithUndo(ids, { is_archived: true }, ids.length === 1 ? 'הועבר לארכיון' : `${ids.length} משימות הועברו לארכיון`);
  const ui = useUI.getState();
  if (ui.openTaskId && ids.includes(ui.openTaskId)) ui.openTask(null);
}

export function duplicateTask(id: string) {
  const raw = getRaw();
  const t = raw?.tasks.find((x) => x.id === id);
  if (!raw || !t) return;
  const newTaskId = createTask({
    ...t, id: undefined, title: `${t.title} (עותק)`, status: 'todo', position: t.position + 0.5,
    label_ids: raw.taskLabels.filter((l) => l.task_id === id).map((l) => l.label_id),
  }, { open: true });
  const items = raw.checklist.filter((c) => c.task_id === id).map((c) => ({ ...c, id: newId(), task_id: newTaskId, is_done: false }));
  if (items.length) {
    patchRaw((s) => ({ checklist: [...s.checklist, ...items] }));
    void exec({ t: 'insert', table: 'checklist_items', rows: items });
  }
  toast.success('המשימה שוכפלה');
}

export function setTaskLabels(id: string, labelIds: string[]) {
  const raw = getRaw();
  if (!raw) return;
  const current = raw.taskLabels.filter((l) => l.task_id === id).map((l) => l.label_id);
  const add = labelIds.filter((l) => !current.includes(l));
  const remove = current.filter((l) => !labelIds.includes(l));
  patchRaw((s) => ({
    taskLabels: [...s.taskLabels.filter((l) => l.task_id !== id), ...labelIds.map((l) => ({ task_id: id, label_id: l }))],
  }));
  const ops: Op[] = [];
  if (add.length) ops.push({ t: 'insert', table: 'task_labels', rows: add.map((l) => ({ task_id: id, label_id: l })) });
  for (const l of remove) ops.push({ t: 'delete', table: 'task_labels', match: { task_id: id, label_id: l } });
  if (ops.length) void exec(...ops);
}

export function reorderTasks(ids: string[], groupId?: string | null, topicId?: string | null) {
  const setGroup = groupId !== undefined;
  patchRaw((s) => ({
    tasks: s.tasks.map((t) => {
      const i = ids.indexOf(t.id);
      if (i === -1) return t;
      return { ...t, position: i + 1, ...(setGroup ? { group_id: groupId, topic_id: topicId ?? t.topic_id } : {}) };
    }),
  }));
  void exec({ t: 'rpc', fn: 'reorder', args: { p_table: 'tasks', p_ids: ids, p_group: groupId ?? null, p_topic: topicId ?? null, p_set_group: setGroup } });
}

// ---------------------------------------------------------------- צ'קליסט
export function addChecklist(taskId: string, text: string) {
  const raw = getRaw();
  const pos = (raw?.checklist.filter((c) => c.task_id === taskId).reduce((m, c) => Math.max(m, c.position), 0) ?? 0) + 1;
  const row: ChecklistItem = { id: newId(), task_id: taskId, text: text.trim().slice(0, 500), is_done: false, position: pos };
  patchRaw((s) => ({ checklist: [...s.checklist, row] }));
  void exec({ t: 'insert', table: 'checklist_items', rows: [row] });
}
export function updateChecklist(id: string, patch: Partial<ChecklistItem>) {
  patchRaw((s) => ({ checklist: patchList(s.checklist, id, patch) }));
  void exec({ t: 'update', table: 'checklist_items', match: { id }, patch });
}
export function deleteChecklist(id: string) {
  patchRaw((s) => ({ checklist: s.checklist.filter((c) => c.id !== id) }));
  void exec({ t: 'delete', table: 'checklist_items', match: { id } });
}

// ---------------------------------------------------------------- טיימר
export function startTimer(taskId: string) {
  const now = nowIso();
  patchRaw((s) => ({
    timeEntries: [...s.timeEntries.map((e) => (e.ended_at ? e : { ...e, ended_at: now })), { id: newId(), task_id: taskId, started_at: now, ended_at: null }],
  }));
  void exec({ t: 'rpc', fn: 'timer_start', args: { p_task: taskId } });
}
export function stopTimer() {
  const now = nowIso();
  patchRaw((s) => ({ timeEntries: s.timeEntries.map((e) => (e.ended_at ? e : { ...e, ended_at: now })) }));
  void exec({ t: 'rpc', fn: 'timer_stop', args: {} });
}
export function addTimeEntry(taskId: string, minutes: number) {
  const end = new Date();
  const row = { id: newId(), task_id: taskId, started_at: new Date(end.getTime() - minutes * 60000).toISOString(), ended_at: end.toISOString() };
  patchRaw((s) => ({ timeEntries: [...s.timeEntries, row] }));
  void exec({ t: 'insert', table: 'time_entries', rows: [row] });
}

// ---------------------------------------------------------------- תלויות
export async function addDependency(taskId: string, dependsOn: string) {
  patchRaw((s) => ({ deps: [...s.deps, { task_id: taskId, depends_on_id: dependsOn }] }));
  await exec({ t: 'insert', table: 'task_dependencies', rows: [{ task_id: taskId, depends_on_id: dependsOn }] });
}
export function removeDependency(taskId: string, dependsOn: string) {
  patchRaw((s) => ({ deps: s.deps.filter((d) => !(d.task_id === taskId && d.depends_on_id === dependsOn)) }));
  void exec({ t: 'delete', table: 'task_dependencies', match: { task_id: taskId, depends_on_id: dependsOn } });
}

// ---------------------------------------------------------------- ישויות כלליות
type ListKey = 'workspaces' | 'topics' | 'groups' | 'labels' | 'sprints' | 'goals' | 'habits' | 'views' | 'templates' | 'documents';
const TABLE: Record<ListKey, string> = {
  workspaces: 'workspaces', topics: 'topics', groups: 'task_groups', labels: 'labels', sprints: 'sprints',
  goals: 'goals', habits: 'habits', views: 'saved_views', templates: 'task_templates', documents: 'documents',
};

export function insertRow(key: ListKey, row: Record<string, unknown> & { id?: string }, extra: Record<string, unknown> = {}): string {
  const id = row.id ?? newId();
  const full = { ...row, id, ...extra };
  patchRaw((s) => ({ [key]: [...(s[key] as unknown[]), { created_at: nowIso(), ...full }] }) as Partial<RawState>);
  void exec({ t: 'insert', table: TABLE[key], rows: [full] });
  return id;
}

export function updateRow(key: ListKey, id: string, patch: Record<string, unknown>) {
  patchRaw((s) => ({ [key]: patchList(s[key] as { id: string }[], id, patch) }) as Partial<RawState>);
  void exec({ t: 'update', table: TABLE[key], match: { id }, patch });
}

export function deleteRow(key: ListKey, id: string) {
  patchRaw((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<RawState>);
  void exec({ t: 'delete', table: TABLE[key], match: { id } });
}

export function reorderRows(key: ListKey, ids: string[]) {
  patchRaw((s) => ({ [key]: (s[key] as { id: string; position: number }[]).map((x) => (ids.includes(x.id) ? { ...x, position: ids.indexOf(x.id) + 1 } : x)) }) as Partial<RawState>);
  void exec({ t: 'rpc', fn: 'reorder', args: { p_table: TABLE[key], p_ids: ids } });
}

/** נושא חדש + קבוצה "כללי" */
export function createTopic(input: { name: string; color: string; icon?: string | null; workspace_id: string }): string {
  const raw = getRaw();
  const pos = (raw?.topics.reduce((m, t) => Math.max(m, t.position), 0) ?? 0) + 1;
  const id = insertRow('topics', { ...input, icon: input.icon ?? null, position: pos, is_archived: false });
  insertRow('groups', { topic_id: id, name: 'כללי', color: '#A25DDC', position: 1, is_collapsed: false });
  return id;
}

export function toggleHabit(habitId: string, date: string) {
  const raw = getRaw();
  const exists = raw?.habitLogs.some((l) => l.habit_id === habitId && l.date === date);
  if (exists) {
    patchRaw((s) => ({ habitLogs: s.habitLogs.filter((l) => !(l.habit_id === habitId && l.date === date)) }));
    void exec({ t: 'delete', table: 'habit_logs', match: { habit_id: habitId, date } });
  } else {
    patchRaw((s) => ({ habitLogs: [...s.habitLogs, { habit_id: habitId, date }] }));
    void exec({ t: 'insert', table: 'habit_logs', rows: [{ habit_id: habitId, date }] });
  }
}

export function updateSettings(patch: Record<string, unknown>) {
  const raw = getRaw();
  if (!raw?.profile) return;
  const settings = { ...raw.profile.settings, ...patch };
  patchRaw((s) => ({ profile: s.profile ? { ...s.profile, settings } : s.profile }));
  void exec({ t: 'update', table: 'profiles', match: { user_id: raw.profile.user_id }, patch: { settings } });
}

export function updateDisplayName(name: string) {
  const raw = getRaw();
  if (!raw?.profile) return;
  patchRaw((s) => ({ profile: s.profile ? { ...s.profile, display_name: name } : s.profile }));
  void exec({ t: 'update', table: 'profiles', match: { user_id: raw.profile.user_id }, patch: { display_name: name } });
}

export function applyTemplate(templateId: string, parentId: string) {
  const raw = getRaw();
  const tpl = raw?.templates.find((t) => t.id === templateId);
  const parent = raw?.tasks.find((t) => t.id === parentId);
  if (!tpl || !parent) return;
  tpl.items.forEach((it, i) => createTask({
    title: typeof it === 'string' ? it : it.title, parent_id: parentId, topic_id: parent.topic_id,
    group_id: parent.group_id, position: i + 1,
  }, { open: false }));
  toast.success(`נוספו ${tpl.items.length} תתי-משימות מהתבנית`);
}

export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];
