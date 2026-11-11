// כל התאריכים כאן מקומיים (YYYY-MM-DD). לעולם לא toISOString() — UTC טועה ביום אחרי חצות בישראל.
import type { Task } from '@/types';

const pad = (n: number) => String(n).padStart(2, '0');

export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function addMonths(s: string, n: number): string {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return isoDate(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

export const dow = (s: string) => parseDate(s).getDay(); // 0 = ראשון

/** השבוע מתחיל ביום ראשון */
export const startOfWeek = (s: string) => addDays(s, -dow(s));
export const endOfWeek = (s: string) => addDays(startOfWeek(s), 6);
export const startOfMonth = (s: string) => s.slice(0, 8) + '01';
export function endOfMonth(s: string): string {
  const d = parseDate(s);
  return isoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function today(): string {
  return isoDate(new Date());
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- טווחי משימות ----------
type Dated = Pick<Task, 'start_date' | 'due_date'>;

export function taskRange(t: Dated): [string | null, string | null] {
  return [t.start_date ?? t.due_date, t.due_date ?? t.start_date];
}

/** התחילה עד d ותאריך היעד אחרי d (או אין יעד) */
export function isOngoing(t: Dated, d: string): boolean {
  return !!t.start_date && t.start_date <= d && (!t.due_date || t.due_date > d);
}

export function overlaps(t: Dated, from: string, to: string): boolean {
  const [s, e] = taskRange(t);
  if (!s && !e) return false;
  const start = s ?? e!;
  const end = e ?? s!;
  // משימה מתמשכת בלי יעד — חופפת כל טווח אחרי שהתחילה
  if (t.start_date && !t.due_date) return t.start_date <= to;
  return start <= to && end >= from;
}

export function visibleInDateViews(t: Pick<Task, 'parent_id' | 'due_date' | 'start_date'>): boolean {
  return !t.parent_id || !!t.due_date || !!t.start_date;
}

export function isOverdue(t: Pick<Task, 'due_date' | 'status'>, ref = today()): boolean {
  return !!t.due_date && t.due_date < ref && t.status !== 'done';
}

// ---------- תצוגה ----------
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const DAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTH_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
export const MONTH_LONG = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

/** "היום", "מחר", "אתמול", "יום ג׳", "12 בנוב׳", או d/M/yy */
export function formatRelative(s: string, ref = today()): string {
  const diff = diffDays(s, ref);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  if (diff === -1) return 'אתמול';
  if (diff > 1 && diff <= 6) return `יום ${DAY_SHORT[dow(s)]}`;
  const d = parseDate(s);
  if (d.getFullYear() === parseDate(ref).getFullYear()) return `${d.getDate()} ב${MONTH_SHORT[d.getMonth()]}`;
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

export function formatLong(s: string): string {
  const d = parseDate(s);
  return `יום ${DAY_LONG[d.getDay()]}, ${d.getDate()} ב${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDM(s: string): string {
  const d = parseDate(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function hebrewDate(s: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  try {
    return new Intl.DateTimeFormat('he-IL-u-ca-hebrew', opts).format(parseDate(s));
  } catch {
    return '';
  }
}

export function hebrewDay(s: string): string {
  return hebrewDate(s, { day: 'numeric' });
}

export function greeting(hour = new Date().getHours()): string {
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  if (hour >= 17 && hour < 22) return 'ערב טוב';
  return 'לילה טוב';
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'עכשיו';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'לפני דקה' : `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString('he-IL');
}

export function formatMinutes(min: number): string {
  if (!min) return '0 דק׳';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} דק׳`;
  return m ? `${h}:${pad(m)} ש׳` : `${h} ש׳`;
}

export function formatClock(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
