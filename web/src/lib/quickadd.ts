// פענוח Quick Add בעברית.
// \b של JS לא מזהה עברית — לכן גבולות מילה הם (^|\s) … (?=\s|$|[,.!?]).
import type { Priority } from '@/types';
import { addDays, addMonths, dow, isoDate, parseDate } from './dates';

const B = '(^|\\s)';
const E = '(?=\\s|$|[,.!?])';

export interface QuickAddContext {
  today: string;
  topics?: { id: string; name: string }[];
  labels?: { id: string; name: string }[];
  sprints?: { id: string; name: string }[];
}

export type ChipKind = 'date' | 'time' | 'priority' | 'topic' | 'label' | 'sprint' | 'recur';
export interface Chip { kind: ChipKind; text: string }

export interface QuickAddResult {
  title: string;
  due_date?: string;
  due_time?: string;
  priority?: Priority;
  topic_id?: string;
  label_ids: string[];
  sprint_id?: string;
  recurrence_rule?: string;
  chips: Chip[];
}

export const WEEKDAYS: Record<string, { code: string; idx: number }> = {
  'ראשון': { code: 'SU', idx: 0 }, 'שני': { code: 'MO', idx: 1 }, 'שלישי': { code: 'TU', idx: 2 },
  'רביעי': { code: 'WE', idx: 3 }, 'חמישי': { code: 'TH', idx: 4 }, 'שישי': { code: 'FR', idx: 5 },
  'שבת': { code: 'SA', idx: 6 },
};
const WD = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

const PRIORITY_WORDS: Record<string, Priority> = {
  'קריטי': 'critical', 'קריטית': 'critical', 'דחוף': 'critical', 'דחופה': 'critical', '1': 'critical',
  'גבוה': 'high', 'גבוהה': 'high', '2': 'high',
  'בינוני': 'medium', 'בינונית': 'medium', '3': 'medium',
  'נמוך': 'low', 'נמוכה': 'low', '4': 'low',
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: 'קריטית', high: 'גבוהה', medium: 'בינונית', low: 'נמוכה',
};

const norm = (s: string) => s.replace(/[\s\-_]/g, '').toLowerCase();

function findByName<T extends { id: string; name: string }>(list: T[] | undefined, token: string): T | undefined {
  if (!list?.length) return undefined;
  const n = norm(token);
  return list.find((x) => norm(x.name) === n) ?? list.find((x) => norm(x.name).startsWith(n));
}

/** המופע הבא של יום בשבוע. includeToday: היום עצמו נחשב */
export function nextWeekday(ref: string, idx: number, includeToday: boolean): string {
  let diff = (idx - dow(ref) + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(ref, diff);
}

function nextMonthDay(ref: string, day: number): string {
  const d = parseDate(ref);
  const tryMonth = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    return isoDate(new Date(y, m, Math.min(day, last)));
  };
  const thisMonth = tryMonth(d.getFullYear(), d.getMonth());
  return thisMonth >= ref ? thisMonth : tryMonth(d.getFullYear(), d.getMonth() + 1);
}

const RECUR_UNITS: Record<string, string> = {
  'ימים': 'DAILY', 'יום': 'DAILY', 'שבועות': 'WEEKLY', 'שבוע': 'WEEKLY', 'חודשים': 'MONTHLY', 'חודש': 'MONTHLY',
};

export function describeRule(rule: string | null | undefined): string {
  if (!rule) return '';
  const p = Object.fromEntries(rule.split(';').map((kv) => kv.split('=')));
  const iv = Number(p.INTERVAL || 1);
  const codeToName = Object.fromEntries(Object.entries(WEEKDAYS).map(([k, v]) => [v.code, k]));
  switch (p.FREQ) {
    case 'DAILY': return iv === 1 ? 'כל יום' : iv === 2 ? 'כל יומיים' : `כל ${iv} ימים`;
    case 'WEEKLY': {
      const base = iv === 1 ? 'כל שבוע' : iv === 2 ? 'כל שבועיים' : `כל ${iv} שבועות`;
      if (p.BYDAY) {
        const days = String(p.BYDAY).split(',').map((c) => codeToName[c]).filter(Boolean);
        return iv === 1 ? `כל יום ${days.join(', ')}` : `${base} ב${days.join(', ')}`;
      }
      return base;
    }
    case 'MONTHLY': {
      const base = iv === 1 ? 'כל חודש' : iv === 2 ? 'כל חודשיים' : `כל ${iv} חודשים`;
      return p.BYMONTHDAY ? `${base} ב-${p.BYMONTHDAY} לחודש` : base;
    }
    case 'YEARLY': return iv === 1 ? 'כל שנה' : `כל ${iv} שנים`;
  }
  return rule;
}

export function parseQuickAdd(input: string, ctx: QuickAddContext): QuickAddResult {
  let s = ` ${input} `;
  const ref = ctx.today;
  const res: QuickAddResult = { title: '', label_ids: [], chips: [] };
  let recurDate: string | undefined;

  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = s.match(re);
    if (m) s = s.replace(re, ' ');
    return m;
  };

  // ---------- 1. חזרתיות ----------
  let m: RegExpMatchArray | null;
  if ((m = take(new RegExp(`${B}כל\\s+(?:יום\\s+)?(${WD})${E}(?!\\s+(?:ימים|שבועות|חודשים))`)))) {
    const wd = WEEKDAYS[m[2]];
    res.recurrence_rule = `FREQ=WEEKLY;BYDAY=${wd.code}`;
    recurDate = nextWeekday(ref, wd.idx, true);
  } else if ((m = take(new RegExp(`${B}כל\\s+(\\d{1,2})\\s+(?:ל|ב)חודש${E}`)))) {
    const day = Math.min(31, Math.max(1, Number(m[2])));
    res.recurrence_rule = `FREQ=MONTHLY;BYMONTHDAY=${day}`;
    recurDate = nextMonthDay(ref, day);
  } else if ((m = take(new RegExp(`${B}כל\\s+(\\d{1,3})\\s+(ימים|שבועות|חודשים)${E}`)))) {
    res.recurrence_rule = `FREQ=${RECUR_UNITS[m[3]]};INTERVAL=${Math.max(1, Number(m[2]))}`;
  } else if ((m = take(new RegExp(`${B}כל\\s+(יומיים|שבועיים|חודשיים)${E}`)))) {
    res.recurrence_rule = { 'יומיים': 'FREQ=DAILY;INTERVAL=2', 'שבועיים': 'FREQ=WEEKLY;INTERVAL=2', 'חודשיים': 'FREQ=MONTHLY;INTERVAL=2' }[m[2]]!;
  } else if ((m = take(new RegExp(`${B}(?:כל\\s+(יום|שבוע|חודש|שנה)|(יומי|שבועי|חודשי|שנתי))${E}`)))) {
    const w = m[2] ?? m[3];
    res.recurrence_rule = `FREQ=${({ 'יום': 'DAILY', 'יומי': 'DAILY', 'שבוע': 'WEEKLY', 'שבועי': 'WEEKLY', 'חודש': 'MONTHLY', 'חודשי': 'MONTHLY', 'שנה': 'YEARLY', 'שנתי': 'YEARLY' } as Record<string, string>)[w]}`;
  }
  if (res.recurrence_rule) res.chips.push({ kind: 'recur', text: describeRule(res.recurrence_rule) });

  // ---------- 2. אסימונים ----------
  s = s.replace(/(^|\s)#([^\s#@!*]+)/g, (full, pre, tok) => {
    if (res.topic_id) return full;
    const t = findByName(ctx.topics, tok);
    if (!t) return full;
    res.topic_id = t.id;
    res.chips.push({ kind: 'topic', text: t.name });
    return pre;
  });
  s = s.replace(/(^|\s)@([^\s#@!*]+)/g, (full, pre, tok) => {
    const l = findByName(ctx.labels, tok);
    if (!l) return full;
    if (!res.label_ids.includes(l.id)) {
      res.label_ids.push(l.id);
      res.chips.push({ kind: 'label', text: l.name });
    }
    return pre;
  });
  s = s.replace(/(^|\s)\*([^\s#@!*]+)/g, (full, pre, tok) => {
    if (res.sprint_id) return full;
    const sp = findByName(ctx.sprints, tok);
    if (!sp) return full;
    res.sprint_id = sp.id;
    res.chips.push({ kind: 'sprint', text: sp.name });
    return pre;
  });
  if ((m = take(new RegExp(`${B}!(${Object.keys(PRIORITY_WORDS).join('|')})${E}`)))) {
    res.priority = PRIORITY_WORDS[m[2]];
  } else if ((m = take(new RegExp(`${B}(!!!|!!)${E}`)))) {
    res.priority = m[2] === '!!!' ? 'critical' : 'high';
  }
  if (res.priority) res.chips.push({ kind: 'priority', text: PRIORITY_LABEL[res.priority] });

  // ---------- 3. שעה ----------
  const setTime = (h: number, mi: number) => {
    if (h > 23 || mi > 59) return false;
    res.due_time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    res.chips.push({ kind: 'time', text: res.due_time });
    return true;
  };
  const timeRe = new RegExp(`${B}(?:ב-?|בשעה\\s+)?(\\d{1,2}):(\\d{2})${E}`);
  const hourRe = new RegExp(`${B}בשעה\\s+(\\d{1,2})${E}`);
  if ((m = s.match(timeRe)) && setTime(Number(m[2]), Number(m[3]))) s = s.replace(timeRe, ' ');
  else if ((m = s.match(hourRe)) && setTime(Number(m[2]), 0)) s = s.replace(hourRe, ' ');

  // ---------- 4. תאריך (הראשון שנמצא מנצח) ----------
  const units = (n: number, unit: string) =>
    unit.startsWith('י') ? addDays(ref, n) : unit.startsWith('ש') ? addDays(ref, 7 * n) : addMonths(ref, n);
  const rules: Array<[RegExp, (m: RegExpMatchArray) => string | undefined]> = [
    [new RegExp(`${B}מחרתיים${E}`), () => addDays(ref, 2)],
    [new RegExp(`${B}מחר${E}`), () => addDays(ref, 1)],
    [new RegExp(`${B}היום${E}`), () => ref],
    [new RegExp(`${B}ב?שבוע הבא${E}`), () => nextWeekday(ref, 0, false)],
    [new RegExp(`${B}ב?חודש הבא${E}`), () => addMonths(ref, 1).slice(0, 8) + '01'],
    [new RegExp(`${B}בעוד\\s+(\\d{1,3})\\s+(ימים|יום|שבועות|שבוע|חודשים|חודש)${E}`), (m) => units(Number(m[2]), m[3])],
    [new RegExp(`${B}בעוד\\s+(יומיים|שבועיים|שבוע|חודש|חודשיים)${E}`), (m) =>
      ({ 'יומיים': addDays(ref, 2), 'שבוע': addDays(ref, 7), 'שבועיים': addDays(ref, 14), 'חודש': addMonths(ref, 1), 'חודשיים': addMonths(ref, 2) } as Record<string, string>)[m[2]]],
    [new RegExp(`${B}(?:ביום\\s+|יום\\s+|ב)(${WD})${E}`), (m) => nextWeekday(ref, WEEKDAYS[m[2]].idx, false)],
    [new RegExp(`${B}(?:ב-?)?(\\d{1,2})[/.](\\d{1,2})(?:[/.](\\d{2}|\\d{4}))?${E}`), (m) => {
      const d = Number(m[2]);
      const mo = Number(m[3]);
      let y = m[4] ? Number(m[4].length === 2 ? `20${m[4]}` : m[4]) : parseDate(ref).getFullYear();
      if (mo < 1 || mo > 12 || d < 1) return undefined;
      const build = (yy: number) => {
        const dt = new Date(yy, mo - 1, d);
        return dt.getMonth() === mo - 1 ? isoDate(dt) : undefined;
      };
      let out = build(y);
      if (!out) return undefined;
      if (!m[4] && out < ref) {
        y += 1;
        out = build(y);
      }
      return out;
    }],
  ];
  for (const [re, fn] of rules) {
    const mm = s.match(re);
    if (!mm) continue;
    const val = fn(mm);
    if (!val) continue;
    res.due_date = val;
    s = s.replace(re, ' ');
    break;
  }
  if (!res.due_date && recurDate) res.due_date = recurDate;
  if (!res.due_date && res.recurrence_rule) res.due_date = ref;
  if (!res.due_date && res.due_time) res.due_date = ref;
  if (res.due_date) {
    const rel = res.due_date === ref ? 'היום' : res.due_date === addDays(ref, 1) ? 'מחר' : (() => {
      const d = parseDate(res.due_date!);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    })();
    res.chips.unshift({ kind: 'date', text: rel });
  }

  res.title = s.replace(/\s+/g, ' ').trim();
  return res;
}
