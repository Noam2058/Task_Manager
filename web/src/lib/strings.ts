import type { Priority, Status } from '@/types';

export const STATUS_LABEL: Record<Status, string> = {
  todo: 'טרם התחיל', in_progress: 'בתהליך', bugfix: 'טיפול באגים', stuck: 'תקוע', done: 'הושלם',
};
export const STATUS_COLOR: Record<Status, string> = {
  todo: 'var(--status-todo)', in_progress: 'var(--status-progress)', bugfix: 'var(--status-bugfix)',
  stuck: 'var(--status-stuck)', done: 'var(--status-done)',
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'קריטית', high: 'גבוהה', medium: 'בינונית', low: 'נמוכה',
};
export const PRIORITY_COLOR: Record<Priority, string> = {
  critical: 'var(--prio-critical)', high: 'var(--prio-high)', medium: 'var(--prio-medium)', low: 'var(--prio-low)',
};

export const S = {
  appName: 'ניהול משימות',
  addTask: 'הוסף משימה',
  newTask: 'משימה חדשה',
  noTasks: 'אין משימות',
  undo: 'בטל',
  save: 'שמירה',
  cancel: 'ביטול',
  delete: 'מחיקה',
  archive: 'העברה לארכיון',
  quickAddHint: 'מחר ב-14:00 #נושא @תווית !גבוה כל יום שני',
  offline: 'אין חיבור — השינויים יישמרו ויסונכרנו כשהחיבור יחזור',
  synced: 'מסונכרן',
};
