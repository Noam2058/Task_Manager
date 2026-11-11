import { test } from 'vitest';
import assert from 'node:assert/strict';
import { habitStreak } from './habits';
import { isOngoing, overlaps, formatRelative, startOfWeek, addMonths, isoDate } from './dates';
import { applyColumnSort, matchesFilters } from './filters';
import { normalizeLegacy } from './legacyImport';

const T = (o: any) => ({ labels: [], checklist: [], depends_on: [], description: '', status: 'todo', priority: 'medium', position: 0, created_at: '', due_date: null, start_date: null, ...o });

test('habit streak daily', () => {
  const s = new Set(['2026-11-03', '2026-11-04']);
  assert.equal(habitStreak({ frequency: 'daily', target_per_week: 1 }, s, '2026-11-05'), 2);
  s.add('2026-11-05');
  assert.equal(habitStreak({ frequency: 'daily', target_per_week: 1 }, s, '2026-11-05'), 3);
  assert.equal(habitStreak({ frequency: 'daily', target_per_week: 1 }, new Set(['2026-11-02']), '2026-11-05'), 0);
});

test('habit streak weekly', () => {
  // שבוע 25/10–31/10: 2 סימונים, שבוע 1/11–7/11: 1 עד עכשיו
  const s = new Set(['2026-10-26', '2026-10-28', '2026-11-02']);
  assert.equal(habitStreak({ frequency: 'weekly', target_per_week: 2 }, s, '2026-11-05'), 1);
});

test('date ranges', () => {
  assert.equal(isOngoing({ start_date: '2026-11-01', due_date: '2026-11-10' }, '2026-11-05'), true);
  assert.equal(isOngoing({ start_date: '2026-11-01', due_date: '2026-11-05' }, '2026-11-05'), false);
  assert.equal(overlaps({ start_date: '2026-10-28', due_date: '2026-11-02' }, '2026-11-01', '2026-11-07'), true);
  assert.equal(overlaps({ start_date: null, due_date: '2026-10-31' }, '2026-11-01', '2026-11-07'), false);
  assert.equal(overlaps({ start_date: '2026-10-01', due_date: null }, '2026-11-01', '2026-11-07'), true);
  assert.equal(startOfWeek('2026-11-05'), '2026-11-01');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(formatRelative('2026-11-06', '2026-11-05'), 'מחר');
  assert.equal(formatRelative('2026-11-09', '2026-11-05'), 'יום ב׳');
  assert.equal(isoDate(new Date(2026, 0, 1, 23, 30)), '2026-01-01');
});

test('filters and sort', () => {
  const a = T({ id: 'a', title: 'ב', due_date: '2026-11-04' });
  const b = T({ id: 'b', title: 'א', due_date: null });
  const c = T({ id: 'c', title: 'ג', due_date: '2026-11-09', status: 'done' });
  assert.equal(matchesFilters(c, {}, '2026-11-05'), false);
  assert.equal(matchesFilters(a, { due: ['overdue'] }, '2026-11-05'), true);
  assert.equal(matchesFilters(b, { due: ['none'] }, '2026-11-05'), true);
  assert.deepEqual(applyColumnSort([b, a, c], { key: 'due', dir: 'desc' }).map((t: any) => t.id), ['c', 'a', 'b']);
  assert.deepEqual(applyColumnSort([b, a, c], { key: 'due', dir: 'asc' }).map((t: any) => t.id), ['a', 'c', 'b']);
});

test('legacy import tolerant shapes', () => {
  const r = normalizeLegacy({ data: {
    topics: [{ id: 'x', name: 'נ' }], groups: [{ id: 'g', topic_id: 'x', name: 'ק' }],
    tasks: [{ id: 't', topic_id: 'x', group_id: 'g', title: 'מ', label_ids: ['l'] }],
    labels: [{ id: 'l', name: 'ת' }], views: [{ id: 'v', name: 'ו', page: 'today', filters_json: '{"q":"a"}' }],
  } });
  assert.equal(r.data.tasks[0].group_id, 'g');
  assert.equal(r.data.task_labels.length, 1);
  assert.deepEqual(r.data.saved_views[0].filters, { q: 'a' });
});
