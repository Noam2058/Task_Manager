export * from './dates';
import { addDays, dow } from './dates';
export function nextWeekdayIso(ref: string, idx: number): string {
  let diff = (idx - dow(ref) + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(ref, diff);
}
