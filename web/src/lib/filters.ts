import type { Filters, Priority, SortKey, Status, Task } from '@/types';
import { endOfWeek, isOverdue, today as todayFn } from './dates';

export const STATUS_ORDER: Status[] = ['todo', 'in_progress', 'bugfix', 'stuck', 'done'];
export const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'medium', 'low'];

export function matchesFilters(t: Task, f: Filters, today = todayFn()): boolean {
  if (!f.showDone && t.status === 'done' && !f.statuses?.includes('done')) return false;
  if (f.statuses?.length && !f.statuses.includes(t.status)) return false;
  if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
  if (f.labels?.length && !f.labels.some((l) => t.labels.includes(l))) return false;
  if (f.topics?.length && !f.topics.includes(t.topic_id ?? '')) return false;
  if (f.sprints?.length && !f.sprints.includes(t.sprint_id ?? '')) return false;
  if (f.due?.length) {
    const ok = f.due.some((d) =>
      d === 'overdue' ? isOverdue(t, today)
        : d === 'today' ? t.due_date === today
          : d === 'week' ? !!t.due_date && t.due_date >= today && t.due_date <= endOfWeek(today)
            : !t.due_date);
    if (!ok) return false;
  }
  if (f.q?.trim()) {
    const q = f.q.trim().toLowerCase();
    if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
  }
  return true;
}

export function activeFilterCount(f: Filters): number {
  return (f.statuses?.length ?? 0) + (f.priorities?.length ?? 0) + (f.due?.length ?? 0) +
    (f.labels?.length ?? 0) + (f.topics?.length ?? 0) + (f.sprints?.length ?? 0) + (f.showDone ? 1 : 0);
}

export type ColumnSort = { key: 'title' | 'topic' | 'status' | 'priority' | 'due'; dir: 'asc' | 'desc' } | null;

/** ריקים תמיד בסוף */
export function compareTasks(a: Task, b: Task, key: SortKey | 'topic' | 'status', topicName?: (id: string | null) => string): number {
  const emptyLast = (x: string | null | undefined, y: string | null | undefined) => {
    if (!x && !y) return 0;
    if (!x) return 1;
    if (!y) return -1;
    return x < y ? -1 : x > y ? 1 : 0;
  };
  switch (key) {
    case 'due': return emptyLast(a.due_date, b.due_date) || emptyLast(a.due_time, b.due_time);
    case 'priority': return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    case 'status': return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    case 'title': return a.title.localeCompare(b.title, 'he');
    case 'topic': return (topicName?.(a.topic_id) ?? '').localeCompare(topicName?.(b.topic_id) ?? '', 'he');
    case 'created': return b.created_at.localeCompare(a.created_at);
    default: return a.position - b.position;
  }
}

export function sortTasks(list: Task[], key: SortKey = 'manual'): Task[] {
  return [...list].sort((a, b) => compareTasks(a, b, key) || a.position - b.position);
}

export function applyColumnSort(list: Task[], sort: ColumnSort, topicName?: (id: string | null) => string): Task[] {
  if (!sort) return list;
  const out = [...list].sort((a, b) => compareTasks(a, b, sort.key, topicName));
  if (sort.dir === 'desc') {
    // הפיכה תוך שמירת ריקים בסוף
    const empty = (t: Task) => (sort.key === 'due' ? !t.due_date : false);
    const filled = out.filter((t) => !empty(t)).reverse();
    return [...filled, ...out.filter(empty)];
  }
  return out;
}

/** משימה חסומה = יש תלות שלא הושלמה */
export function isBlocked(t: Task, byId: Map<string, Task>): boolean {
  return t.depends_on.some((id) => byId.get(id) && byId.get(id)!.status !== 'done');
}
