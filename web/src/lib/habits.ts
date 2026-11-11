import type { Habit } from '@/types';
import { addDays, startOfWeek } from './dates';

/** רצף: יומי — ימים רצופים עד היום (אם היום עוד לא סומן — מאתמול).
 *  שבועי — שבועות רצופים שעמדו ביעד (אם השבוע הנוכחי עוד לא עמד — מהשבוע הקודם). */
export function habitStreak(h: Pick<Habit, 'frequency' | 'target_per_week'>, dates: Set<string>, today: string): number {
  if (h.frequency === 'daily') {
    let d = dates.has(today) ? today : addDays(today, -1);
    let n = 0;
    while (dates.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }
  const countWeek = (ws: string) => {
    let c = 0;
    for (let i = 0; i < 7; i++) if (dates.has(addDays(ws, i))) c++;
    return c;
  };
  let ws = startOfWeek(today);
  if (countWeek(ws) < h.target_per_week) ws = addDays(ws, -7);
  let n = 0;
  while (countWeek(ws) >= h.target_per_week) { n++; ws = addDays(ws, -7); }
  return n;
}
