// שכבת הנתונים: טעינה מלאה, תור שינויים לא-מקוון (outbox), ושמירת cache מקומית לקריאה בלי רשת.
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { toast } from 'sonner';
import { supabase } from './supabase';
import type {
  ChecklistItem, Dependency, DocumentRow, Goal, Habit, HabitLog, Label, Profile, SavedView, Sprint,
  TaskGroup, TaskRow, Template, TimeEntry, Topic, Workspace,
} from '@/types';
import { queryClient } from './queryClient';

export interface RawState {
  workspaces: Workspace[];
  topics: Topic[];
  groups: TaskGroup[];
  tasks: TaskRow[];
  labels: Label[];
  taskLabels: { task_id: string; label_id: string }[];
  checklist: ChecklistItem[];
  timeEntries: TimeEntry[];
  deps: Dependency[];
  sprints: Sprint[];
  goals: Goal[];
  habits: Habit[];
  habitLogs: HabitLog[];
  documents: DocumentRow[];
  views: SavedView[];
  templates: Template[];
  profile: Profile | null;
}

export const STATE_KEY = ['state'] as const;
const CACHE_KEY = 'tm-state-cache-v2';

async function fetchAll<T>(table: string, columns = '*', order?: string): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select(columns).range(from, from + page - 1);
    if (order) q = q.order(order);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function fetchRaw(): Promise<RawState> {
  const [
    workspaces, topics, groups, tasks, labels, taskLabels, checklist, timeEntries, deps,
    sprints, goals, habits, habitLogs, documents, views, templates, profiles,
  ] = await Promise.all([
    fetchAll<Workspace>('workspaces', '*', 'position'),
    fetchAll<Topic>('topics', '*', 'position'),
    fetchAll<TaskGroup>('task_groups', '*', 'position'),
    fetchAll<TaskRow>('tasks', '*', 'id'),
    fetchAll<Label>('labels', '*', 'name'),
    fetchAll<{ task_id: string; label_id: string }>('task_labels', 'task_id,label_id'),
    fetchAll<ChecklistItem>('checklist_items', 'id,task_id,text,is_done,position', 'position'),
    fetchAll<TimeEntry>('time_entries', 'id,task_id,started_at,ended_at', 'id'),
    fetchAll<Dependency>('task_dependencies', 'task_id,depends_on_id'),
    fetchAll<Sprint>('sprints', '*', 'position'),
    fetchAll<Goal>('goals', '*', 'position'),
    fetchAll<Habit>('habits', '*', 'position'),
    fetchAll<HabitLog>('habit_logs', 'habit_id,date'),
    fetchAll<DocumentRow>('documents', '*', 'uploaded_at'),
    fetchAll<SavedView>('saved_views', '*', 'created_at'),
    fetchAll<Template>('task_templates', '*', 'name'),
    fetchAll<Profile>('profiles', 'user_id,display_name,settings'),
  ]);
  const raw: RawState = {
    workspaces, topics, groups, tasks, labels, taskLabels, checklist, timeEntries, deps,
    sprints, goals, habits, habitLogs, documents, views, templates, profile: profiles[0] ?? null,
  };
  void idbSet(CACHE_KEY, raw).catch(() => {});
  return raw;
}

export async function loadCachedRaw(): Promise<RawState | undefined> {
  try {
    return (await idbGet(CACHE_KEY)) as RawState | undefined;
  } catch {
    return undefined;
  }
}

export function persistCache(raw: RawState) {
  void idbSet(CACHE_KEY, raw).catch(() => {});
}

// =====================================================================
// Outbox — כל כתיבה עוברת כאן. בלי רשת → נשמרת ונשלחת כשהחיבור חוזר.
// =====================================================================
export type Op =
  | { t: 'insert'; table: string; rows: Record<string, any>[] }
  | { t: 'update'; table: string; match: Record<string, any>; patch: Record<string, any> }
  | { t: 'updateIn'; table: string; column: string; values: string[]; patch: Record<string, any> }
  | { t: 'delete'; table: string; match: Record<string, any> }
  | { t: 'deleteIn'; table: string; column: string; values: string[] }
  | { t: 'rpc'; fn: string; args: Record<string, any> };

interface QueuedOp { id: string; op: Op; tries: number }

const OUTBOX_KEY = 'tm-outbox';
let outbox: QueuedOp[] = (() => {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
})();
const listeners = new Set<() => void>();
const saveOutbox = () => {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch { /* quota */ }
  listeners.forEach((l) => l());
};
export const outboxSize = () => outbox.length;
export const onOutboxChange = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };

const isNetworkError = (e: unknown) => {
  const msg = String((e as { message?: string })?.message ?? e);
  return !navigator.onLine || /Failed to fetch|NetworkError|Load failed|network|fetch failed|timeout/i.test(msg);
};

async function runOp(op: Op): Promise<void> {
  let res: { error: { message: string; hint?: string | null; code?: string } | null };
  switch (op.t) {
    case 'insert':
      res = await supabase.from(op.table).upsert(op.rows, { ignoreDuplicates: true });
      break;
    case 'update': {
      let q = supabase.from(op.table).update(op.patch);
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as string);
      res = await q;
      break;
    }
    case 'updateIn':
      res = await supabase.from(op.table).update(op.patch).in(op.column, op.values);
      break;
    case 'delete': {
      let q = supabase.from(op.table).delete();
      for (const [k, v] of Object.entries(op.match)) q = q.eq(k, v as string);
      res = await q;
      break;
    }
    case 'deleteIn':
      res = await supabase.from(op.table).delete().in(op.column, op.values);
      break;
    case 'rpc':
      res = await supabase.rpc(op.fn, op.args);
      break;
  }
  if (res.error) throw Object.assign(new Error(res.error.message), { hint: res.error.hint, code: res.error.code });
}

let flushing = false;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

/** אחרי כתיבה — טריגרים בשרת (חזרתיות, אוטומציות) עשויים לשנות עוד שורות */
export function scheduleRefresh(ms = 700) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    if (!outbox.length) void queryClient.invalidateQueries({ queryKey: STATE_KEY });
  }, ms);
}

function serverErrorMessage(e: unknown): string {
  const err = e as { message?: string; hint?: string };
  if (err.message === 'DEPENDENCY_CYCLE') return err.hint || 'התלות הזו יוצרת מעגל';
  if (/row-level security/i.test(err.message ?? '')) return 'אין הרשאה לפעולה הזו';
  if (/JWT|not authenticated/i.test(err.message ?? '')) return 'פג תוקף ההתחברות — התחבר מחדש';
  return 'השמירה נכשלה: ' + (err.message ?? 'שגיאה לא ידועה');
}

export async function flushOutbox(): Promise<void> {
  if (flushing || !outbox.length || !navigator.onLine) return;
  flushing = true;
  try {
    while (outbox.length) {
      const item = outbox[0];
      try {
        await runOp(item.op);
        outbox.shift();
        saveOutbox();
      } catch (e) {
        if (isNetworkError(e)) break;
        // שגיאת שרת אמיתית — מוותרים על הפעולה ומרעננים
        outbox.shift();
        saveOutbox();
        toast.error(serverErrorMessage(e));
      }
    }
  } finally {
    flushing = false;
    if (!outbox.length) scheduleRefresh(300);
  }
}

/** מריץ פעולה. מחזיר false אם נכשלה בשגיאת שרת (העדכון האופטימי יבוטל ע"י רענון). */
export async function exec(...ops: Op[]): Promise<boolean> {
  if (outbox.length || !navigator.onLine) {
    outbox.push(...ops.map((op) => ({ id: crypto.randomUUID?.() ?? String(Math.random()), op, tries: 0 })));
    saveOutbox();
    void flushOutbox();
    return true;
  }
  for (let i = 0; i < ops.length; i++) {
    try {
      await runOp(ops[i]);
    } catch (e) {
      if (isNetworkError(e)) {
        outbox.push(...ops.slice(i).map((op) => ({ id: String(Math.random()), op, tries: 0 })));
        saveOutbox();
        return true;
      }
      toast.error(serverErrorMessage(e));
      void queryClient.invalidateQueries({ queryKey: STATE_KEY });
      return false;
    }
  }
  scheduleRefresh();
  return true;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flushOutbox());
  setInterval(() => void flushOutbox(), 30000);
}

// =====================================================================
// עדכון אופטימי של ה-cache
// =====================================================================
export function patchRaw(fn: (s: RawState) => Partial<RawState>) {
  queryClient.setQueryData<RawState>(STATE_KEY, (old) => {
    if (!old) return old;
    const next = { ...old, ...fn(old) };
    persistCache(next);
    return next;
  });
}

export const getRaw = () => queryClient.getQueryData<RawState>(STATE_KEY);

export function upsertList<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i === -1) return [...list, row];
  const copy = list.slice();
  copy[i] = { ...copy[i], ...row };
  return copy;
}

export function patchList<T extends { id: string }>(list: T[], ids: string[] | string, patch: Partial<T>): T[] {
  const set = new Set(Array.isArray(ids) ? ids : [ids]);
  return list.map((x) => (set.has(x.id) ? { ...x, ...patch } : x));
}
