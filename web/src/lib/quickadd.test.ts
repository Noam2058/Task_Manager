import { test } from 'vitest';
import assert from 'node:assert/strict';
import { parseQuickAdd, describeRule } from './quickadd';

// תאריך קבוע: חמישי 5/11/2026
const ctx = {
  today: '2026-11-05',
  topics: [{ id: 't1', name: 'עבודה' }, { id: 't2', name: 'בית ספר' }, { id: 't3', name: 'אישי' }],
  labels: [{ id: 'l1', name: 'דחוף' }, { id: 'l2', name: 'מעקב' }],
  sprints: [{ id: 's1', name: 'נובמבר' }],
};
const p = (s: string) => parseQuickAdd(s, ctx);

const cases: Array<[string, Partial<ReturnType<typeof p>>]> = [
  ['לקנות חלב', { title: 'לקנות חלב', due_date: undefined }],
  ['לקנות חלב מחר', { title: 'לקנות חלב', due_date: '2026-11-06' }],
  ['פגישה מחרתיים', { title: 'פגישה', due_date: '2026-11-07' }],
  ['דוח היום', { title: 'דוח', due_date: '2026-11-05' }],
  ['תכנון שבוע הבא', { title: 'תכנון', due_date: '2026-11-08' }],
  ['תכנון בשבוע הבא', { title: 'תכנון', due_date: '2026-11-08' }],
  ['חשבונות בחודש הבא', { title: 'חשבונות', due_date: '2026-12-01' }],
  ['רופא בעוד 3 ימים', { title: 'רופא', due_date: '2026-11-08' }],
  ['רופא בעוד שבועיים', { title: 'רופא', due_date: '2026-11-19' }],
  ['רופא בעוד 2 חודשים', { title: 'רופא', due_date: '2027-01-05' }],
  ['ישיבה ביום שני', { title: 'ישיבה', due_date: '2026-11-09' }],
  ['ישיבה בחמישי', { title: 'ישיבה', due_date: '2026-11-12' }], // אותו יום = שבוע הבא
  ['יום הולדת 12/11', { title: 'יום הולדת', due_date: '2026-11-12' }],
  ['יום הולדת 3.2', { title: 'יום הולדת', due_date: '2027-02-03' }], // בעבר → שנה הבאה
  ['חתונה 1/5/27', { title: 'חתונה', due_date: '2027-05-01' }],
  ['משהו 31/2', { title: 'משהו 31/2', due_date: undefined }], // תאריך לא חוקי
  ['שיחה מחר ב-14:30', { title: 'שיחה', due_date: '2026-11-06', due_time: '14:30' }],
  ['שיחה בשעה 9', { title: 'שיחה', due_date: '2026-11-05', due_time: '09:00' }],
  ['שיחה 25:00', { title: 'שיחה 25:00', due_time: undefined }],
  ['באג #עבודה !גבוה', { title: 'באג', topic_id: 't1', priority: 'high' }],
  ['מבחן #בית_ספר', { title: 'מבחן', topic_id: 't2' }],
  ['מבחן #ביתספר', { title: 'מבחן', topic_id: 't2' }],
  ['משהו #אי', { title: 'משהו', topic_id: 't3' }], // קידומת
  ['משהו #לאקיים', { title: 'משהו #לאקיים', topic_id: undefined }],
  ['תיקון @דחוף @מעקב', { title: 'תיקון', label_ids: ['l1', 'l2'] }],
  ['שרת נפל !!!', { title: 'שרת נפל', priority: 'critical' }],
  ['עדכון !!', { title: 'עדכון', priority: 'high' }],
  ['עדכון !4', { title: 'עדכון', priority: 'low' }],
  ['משימה *נובמבר', { title: 'משימה', sprint_id: 's1' }],
  ['ספורט כל יום', { title: 'ספורט', recurrence_rule: 'FREQ=DAILY', due_date: '2026-11-05' }],
  ['דיווח שבועי', { title: 'דיווח', recurrence_rule: 'FREQ=WEEKLY' }],
  ['ישיבת צוות כל יום ראשון', { title: 'ישיבת צוות', recurrence_rule: 'FREQ=WEEKLY;BYDAY=SU', due_date: '2026-11-08' }],
  ['ישיבת צוות כל חמישי', { title: 'ישיבת צוות', recurrence_rule: 'FREQ=WEEKLY;BYDAY=TH', due_date: '2026-11-05' }],
  ['השקיה כל 3 ימים', { title: 'השקיה', recurrence_rule: 'FREQ=DAILY;INTERVAL=3' }],
  ['שכר דירה כל 10 לחודש', { title: 'שכר דירה', recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=10', due_date: '2026-11-10' }],
  ['חשמל כל 1 לחודש', { title: 'חשמל', recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=1', due_date: '2026-12-01' }],
  ['גינה כל שבועיים', { title: 'גינה', recurrence_rule: 'FREQ=WEEKLY;INTERVAL=2' }],
  ['פרק ראשון בספר', { title: 'פרק ראשון בספר', due_date: undefined }],
  ['שני דברים לקנות', { title: 'שני דברים לקנות', due_date: undefined }],
  ['מחרוזת', { title: 'מחרוזת', due_date: undefined }],
  ['לקנות מתנה מחר, דחוף', { title: 'לקנות מתנה , דחוף', due_date: '2026-11-06' }],
  ['הכל ביחד מחר ב-9:15 #עבודה @מעקב !קריטי', { title: 'הכל ביחד', due_date: '2026-11-06', due_time: '09:15', topic_id: 't1', label_ids: ['l2'], priority: 'critical' }],
];

for (const [input, exp] of cases) {
  test(input, () => {
    const r = p(input);
    for (const [k, v] of Object.entries(exp)) assert.deepEqual((r as any)[k], v, `${k} for "${input}"`);
  });
}

test('describeRule', () => {
  assert.equal(describeRule('FREQ=WEEKLY;BYDAY=SU'), 'כל יום ראשון');
  assert.equal(describeRule('FREQ=DAILY;INTERVAL=2'), 'כל יומיים');
  assert.equal(describeRule('FREQ=MONTHLY;BYMONTHDAY=10'), 'כל חודש ב-10 לחודש');
});

test('chips', () => {
  const r = p('שיחה מחר ב-14:30 #עבודה');
  assert.deepEqual(r.chips.map((c) => c.kind), ['date', 'topic', 'time']);
});
