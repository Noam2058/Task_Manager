import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AppState, Task } from '@/types';
import { fetchRaw, STATE_KEY, type RawState } from './db';
import { useUI } from '@/store/useUIStore';
import { isOverdue, today as todayFn } from './dates';

export function enrich(raw: RawState): AppState {
  const labelsBy = new Map<string, string[]>();
  for (const tl of raw.taskLabels) (labelsBy.get(tl.task_id) ?? labelsBy.set(tl.task_id, []).get(tl.task_id)!).push(tl.label_id);
  const checkBy = new Map<string, Task['checklist']>();
  for (const c of raw.checklist) (checkBy.get(c.task_id) ?? checkBy.set(c.task_id, []).get(c.task_id)!).push(c);
  const depsBy = new Map<string, string[]>();
  for (const d of raw.deps) (depsBy.get(d.task_id) ?? depsBy.set(d.task_id, []).get(d.task_id)!).push(d.depends_on_id);
  const subsBy = new Map<string, string[]>();
  for (const t of raw.tasks) if (t.parent_id) (subsBy.get(t.parent_id) ?? subsBy.set(t.parent_id, []).get(t.parent_id)!).push(t.id);
  const docsBy = new Map<string, number>();
  for (const d of raw.documents) if (d.task_id) docsBy.set(d.task_id, (docsBy.get(d.task_id) ?? 0) + 1);
  const now = Date.now();
  const minutesBy = new Map<string, number>();
  const timerBy = new Map<string, string>();
  for (const e of raw.timeEntries) {
    const end = e.ended_at ? new Date(e.ended_at).getTime() : now;
    minutesBy.set(e.task_id, (minutesBy.get(e.task_id) ?? 0) + Math.max(0, end - new Date(e.started_at).getTime()) / 60000);
    if (!e.ended_at) timerBy.set(e.task_id, e.started_at);
  }
  const tasks: Task[] = raw.tasks.map((t) => {
    const checklist = (checkBy.get(t.id) ?? []).sort((a, b) => a.position - b.position);
    return {
      ...t,
      labels: labelsBy.get(t.id) ?? [],
      checklist,
      checklist_total: checklist.length,
      checklist_done: checklist.filter((c) => c.is_done).length,
      tracked_minutes: Math.round(minutesBy.get(t.id) ?? 0),
      timer_started_at: timerBy.get(t.id) ?? null,
      depends_on: depsBy.get(t.id) ?? [],
      subtask_ids: subsBy.get(t.id) ?? [],
      doc_count: docsBy.get(t.id) ?? 0,
    };
  });
  return {
    workspaces: raw.workspaces, topics: raw.topics, groups: raw.groups, tasks, labels: raw.labels,
    sprints: raw.sprints, goals: raw.goals, habits: raw.habits, habitLogs: raw.habitLogs,
    documents: raw.documents, views: raw.views, templates: raw.templates, profile: raw.profile,
  };
}

export function useRawState(enabled = true) {
  return useQuery({ queryKey: STATE_KEY, queryFn: fetchRaw, enabled });
}

const EMPTY: AppState = {
  workspaces: [], topics: [], groups: [], tasks: [], labels: [], sprints: [], goals: [], habits: [],
  habitLogs: [], documents: [], views: [], templates: [], profile: null,
};

/** כל הנתונים (בלי סינון מרחב) */
// מטמון ברמת המודול — כל הקומפוננטות חולקות את אותה העשרה (ולא מחשבות אותה שוב בכל שורה)
const enrichCache = new WeakMap<RawState, AppState>();
function enrichCached(raw: RawState): AppState {
  let v = enrichCache.get(raw);
  if (!v) { v = enrich(raw); enrichCache.set(raw, v); }
  return v;
}

export function useAllData(): AppState & { isLoading: boolean } {
  const q = useRawState();
  const data = q.data ? enrichCached(q.data) : EMPTY;
  const isLoading = q.isLoading && !q.data;
  return useMemo(() => ({ ...data, isLoading }), [data, isLoading]);
}

type Scoped = AppState & { isLoading: boolean; byId: Map<string, Task>; topicById: Map<string, AppState['topics'][number]> };
const scopedCache = new WeakMap<AppState, Map<string, Scoped>>();

/** נתונים מסוננים לפי המרחב הפעיל (עבודה / אישי / הכל) */
export function useData(): Scoped {
  const q = useRawState();
  const ws = useUI((s) => s.activeWorkspace);
  const base = q.data ? enrichCached(q.data) : EMPTY;
  const isLoading = q.isLoading && !q.data;
  let perWs = scopedCache.get(base);
  if (!perWs) { perWs = new Map(); scopedCache.set(base, perWs); }
  const key = `${ws}|${isLoading}`;
  const hit = perWs.get(key);
  if (hit) return hit;
  const all = { ...base, isLoading };
  const computed = (() => {
    const scoped = ws === 'all' || !all.workspaces.some((w) => w.id === ws) ? all : {
      ...all,
      topics: all.topics.filter((t) => t.workspace_id === ws),
      tasks: all.tasks.filter((t) => !t.workspace_id || t.workspace_id === ws),
      sprints: all.sprints.filter((s) => !s.workspace_id || s.workspace_id === ws),
      goals: all.goals.filter((g) => !g.workspace_id || g.workspace_id === ws),
    };
    const liveTopicIds = new Set(scoped.topics.filter((t) => !t.is_archived).map((t) => t.id));
    const tasks = scoped.tasks.filter((t) => !t.is_archived && (!t.topic_id || liveTopicIds.has(t.topic_id) || !all.topics.some((x) => x.id === t.topic_id)));
    return {
      ...scoped,
      tasks,
      byId: new Map<string, Task>(all.tasks.map((t) => [t.id, t] as [string, Task])),
      topicById: new Map<string, AppState['topics'][number]>(all.topics.map((t) => [t.id, t] as [string, AppState['topics'][number]])),
    };
  })();
  perWs.set(key, computed);
  return computed;
}

export function useTask(id: string | null | undefined): Task | undefined {
  const { byId } = useData();
  return id ? byId.get(id) : undefined;
}

/** ספירות לסיידבר ולניווט התחתון */
export function useCounts() {
  const { tasks } = useData();
  return useMemo(() => {
    const t = todayFn();
    const open = tasks.filter((x) => x.status !== 'done');
    return {
      today: open.filter((x) => x.due_date === t || (x.start_date && x.start_date <= t && (!x.due_date || x.due_date > t))).length,
      overdue: open.filter((x) => isOverdue(x, t)).length,
      inbox: open.filter((x) => !x.parent_id && !x.due_date && !x.start_date).length,
    };
  }, [tasks]);
}

export function useActiveWorkspaceId(): string | null {
  const { workspaces } = useAllData();
  const ws = useUI((s) => s.activeWorkspace);
  if (ws !== 'all' && workspaces.some((w) => w.id === ws)) return ws;
  return workspaces[0]?.id ?? null;
}
