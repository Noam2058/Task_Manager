import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, Clock, Flame, ListTodo, SunMedium, TrendingDown, TrendingUp } from 'lucide-react';
import type { Task } from '@/types';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { addDays, endOfWeek, formatDM, formatLong, greeting, isOngoing, isoDate, startOfWeek, today, visibleInDateViews } from '@/lib/dates';
import { matchesFilters, sortTasks, STATUS_ORDER } from '@/lib/filters';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable, type Section } from '@/components/tasks/TaskTable';
import { FilterBar, useFilters } from '@/components/tasks/FilterBar';
import { Card, CardHeader, IconTile, PriorityBadge, ProgressBar, DatePill, EmptyState } from '@/components/ui/misc';
import { SegmentedControl } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type GroupBy = 'status' | 'topic' | 'time';
type Kpi = 'open' | 'done' | 'today' | 'overdue' | null;

const localDay = (iso: string) => isoDate(new Date(iso));

export default function Dashboard() {
  const { tasks, topics, profile } = useData();
  const openTask = useUI((s) => s.openTask);
  const t = today();
  const [groupBy, setGroupBy] = useState<GroupBy>(() => (localStorage.getItem('tm-overview-group') as GroupBy) || 'time');
  const [subs, setSubs] = useState(() => localStorage.getItem('tm-overview-subtasks') === '1');
  const [kpi, setKpi] = useState<Kpi>(null);
  const [f, setF] = useFilters('dashboard', { sort: 'due' });
  const listRef = useRef<HTMLDivElement>(null);

  const ws = startOfWeek(t);
  const stats = useMemo(() => {
    const open = tasks.filter((x) => x.status !== 'done');
    const doneWeek = tasks.filter((x) => x.completed_at && localDay(x.completed_at) >= ws);
    const donePrev = tasks.filter((x) => x.completed_at && localDay(x.completed_at) >= addDays(ws, -7) && localDay(x.completed_at) < ws);
    const createdWeek = tasks.filter((x) => localDay(x.created_at) >= ws).length;
    const createdPrev = tasks.filter((x) => localDay(x.created_at) >= addDays(ws, -7) && localDay(x.created_at) < ws).length;
    const todayN = open.filter((x) => x.due_date === t || isOngoing(x, t)).length;
    const overdue = open.filter((x) => x.due_date && x.due_date < t).length;
    const minutes = tasks.reduce((s, x) => s + x.tracked_minutes, 0);
    return { open: open.length, doneWeek: doneWeek.length, doneDelta: doneWeek.length - donePrev.length, openDelta: createdWeek - createdPrev, todayN, overdue, hours: Math.round(minutes / 6) / 10 };
  }, [tasks, ws, t]);

  const kpiFilter = (x: Task) =>
    kpi === 'open' ? x.status !== 'done' : kpi === 'done' ? !!x.completed_at && localDay(x.completed_at) >= ws
      : kpi === 'today' ? x.status !== 'done' && (x.due_date === t || isOngoing(x, t)) : kpi === 'overdue' ? x.status !== 'done' && !!x.due_date && x.due_date < t : true;

  const list = sortTasks(tasks.filter((x) => (subs || !x.parent_id) && matchesFilters(x, kpi === 'done' ? { ...f, showDone: true } : f) && kpiFilter(x)), f.sort ?? 'due');

  const sections: Section[] = useMemo(() => {
    if (groupBy === 'status') return STATUS_ORDER.map((s) => ({ id: `ov-s-${s}`, title: STATUS_LABEL[s], color: STATUS_COLOR[s], tasks: list.filter((x) => x.status === s) }));
    if (groupBy === 'topic') return [...topics.filter((tp) => !tp.is_archived).map((tp) => ({ id: `ov-t-${tp.id}`, title: tp.name, color: tp.color, tasks: list.filter((x) => x.topic_id === tp.id) })),
      { id: 'ov-t-none', title: 'ללא נושא', color: 'var(--text-subtle)', tasks: list.filter((x) => !x.topic_id) }];
    const we = endOfWeek(t);
    const b = (x: Task) => x.status === 'done' ? 'done' : x.due_date && x.due_date < t ? 'overdue' : x.due_date === t ? 'today' : isOngoing(x, t) ? 'ongoing' : x.due_date && x.due_date <= we ? 'week' : x.due_date ? 'later' : 'none';
    return ([['overdue', 'באיחור', 'var(--danger)'], ['today', 'להיום', 'var(--primary)'], ['ongoing', 'בביצוע (מתמשכות)', 'var(--status-progress)'], ['week', 'בהמשך השבוע', '#579BFC'], ['later', 'מאוחר יותר', '#A25DDC'], ['none', 'ללא תאריך', 'var(--text-subtle)'], ['done', 'הושלם', 'var(--status-done)']] as const)
      .map(([k, l, c]) => ({ id: `ov-time-${k}`, title: l, color: c, tasks: list.filter((x) => b(x) === k), defaultCollapsed: k === 'done' }));
  }, [groupBy, list, topics, t]);

  const chart30 = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = addDays(t, i - 29);
    return { d: formatDM(d), n: tasks.filter((x) => x.completed_at && localDay(x.completed_at) === d).length };
  }), [tasks, t]);
  const byTopic = useMemo(() => topics.map((tp) => ({ name: tp.name, color: tp.color, value: tasks.filter((x) => x.topic_id === tp.id && x.status !== 'done').length })).filter((x) => x.value), [topics, tasks]);
  const heat = useMemo(() => {
    const counts = new Map<string, number>();
    for (const x of tasks) if (x.completed_at) { const d = localDay(x.completed_at); counts.set(d, (counts.get(d) ?? 0) + 1); }
    const start = addDays(startOfWeek(t), -19 * 7);
    return Array.from({ length: 20 }, (_, w) => Array.from({ length: 7 }, (_, d) => { const day = addDays(start, w * 7 + d); return { day, n: counts.get(day) ?? 0, future: day > t }; }));
  }, [tasks, t]);
  const urgent = tasks.filter((x) => x.status !== 'done' && ((x.due_date && x.due_date <= addDays(t, 2)) || x.priority === 'critical' || x.status === 'stuck'))
    .sort((a, b) => (a.due_date ?? '9').localeCompare(b.due_date ?? '9')).slice(0, 8);

  const pick = (k: Kpi) => { setKpi(kpi === k ? null : k); setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
  const first = (profile?.display_name ?? '').split(' ')[0];
  const heatColor = (n: number) => (n === 0 ? 'var(--surface-3)' : n === 1 ? '#9BE9C1' : n <= 3 ? '#4ED497' : n <= 5 ? '#00C875' : '#037F4C');

  const KPI = ({ k, icon, label, value, delta, goodUp, tone }: { k: Kpi; icon: React.ReactNode; label: string; value: number | string; delta?: number; goodUp?: boolean; tone: string }) => (
    <button onClick={() => k && pick(k)} disabled={!k}
      className={cn('card group flex flex-col gap-2 p-4 text-start transition-all hover:shadow-md disabled:cursor-default', kpi === k && k && 'ring-2 ring-primary')}>
      <div className="flex items-center gap-2 text-sm text-muted"><span className="flex h-7 w-7 items-center justify-center rounded-sm [&>svg]:h-4 [&>svg]:w-4" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}>{icon}</span>{label}</div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular">{value}</span>
        {delta !== undefined && delta !== 0 && (
          <span className={cn('mb-1.5 inline-flex items-center gap-0.5 text-xs font-medium', (delta > 0) === goodUp ? 'text-[var(--success)]' : 'text-danger')}>
            {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(delta)}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className="mx-auto max-w-dash">
      <PageHeader title={`${greeting()}${first ? `, ${first}` : ''}`} description={formatLong(t)} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KPI k="open" icon={<ListTodo />} label="משימות פתוחות" value={stats.open} delta={stats.openDelta} goodUp={false} tone="var(--primary)" />
        <KPI k="done" icon={<CheckCircle2 />} label="הושלמו השבוע" value={stats.doneWeek} delta={stats.doneDelta} goodUp tone="var(--status-done)" />
        <KPI k="today" icon={<SunMedium />} label="להיום" value={stats.todayN} tone="var(--warning)" />
        <KPI k="overdue" icon={<AlertTriangle />} label="באיחור" value={stats.overdue} tone="var(--danger)" />
        <div className="col-span-2 md:col-span-1"><KPI k={null} icon={<Clock />} label="שעות שנרשמו" value={stats.hours} tone="#A25DDC" /></div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="השלמות — 30 יום" />
          <div className="h-48 px-2 pb-3" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart30}>
                <XAxis dataKey="d" reversed tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} interval={4} axisLine={false} tickLine={false} />
                <YAxis orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} width={24} axisLine={false} tickLine={false} />
                <RTooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [v as number, 'הושלמו']} />
                <Bar dataKey="n" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="פתוחות לפי נושא" />
          {byTopic.length ? (
            <div className="flex items-center gap-3 px-4 pb-4">
              <div className="h-36 w-36 shrink-0" dir="ltr">
                <ResponsiveContainer><PieChart><Pie data={byTopic} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">{byTopic.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie></PieChart></ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1 space-y-1">{byTopic.slice(0, 6).map((x) => <div key={x.name} className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: x.color }} /><span className="flex-1 truncate">{x.name}</span><span className="tabular text-muted">{x.value}</span></div>)}</div>
            </div>
          ) : <EmptyState compact icon={<ListTodo />} title="אין משימות פתוחות" />}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="פעילות — 20 שבועות" />
          <div className="overflow-x-auto px-4 pb-4">
            <div className="flex gap-[3px]">
              {heat.map((week, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  {week.map((c) => <div key={c.day} title={`${formatDM(c.day)}: ${c.n}`} className="h-3 w-3 rounded-[3px]" style={{ background: c.future ? 'transparent' : heatColor(c.n) }} />)}
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="הכי דחוף" icon={<Flame />} />
          <div className="px-2 pb-3">
            {urgent.map((x) => (
              <button key={x.id} onClick={() => openTask(x.id)} className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-start hover:bg-surface-2">
                <PriorityBadge priority={x.priority} showLabel={false} />
                <span className="flex-1 truncate text-sm">{x.title}</span>
                <DatePill date={x.due_date} className="text-xs" />
              </button>
            ))}
            {!urgent.length && <div className="px-2 py-4 text-center text-sm text-subtle">אין משהו דחוף 🎉</div>}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {topics.filter((tp) => !tp.is_archived).map((tp) => {
          const all = tasks.filter((x) => x.topic_id === tp.id && !x.parent_id);
          const done = all.filter((x) => x.status === 'done').length;
          return (
            <Link key={tp.id} to={`/topics/${tp.id}`} className="card flex flex-col gap-2 p-4 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-2"><IconTile icon={tp.icon} name={tp.name} color={tp.color} size="md" /><span className="flex-1 truncate font-semibold">{tp.name}</span><span className="text-sm text-muted tabular">{all.length ? Math.round((done / all.length) * 100) : 0}%</span></div>
              <ProgressBar value={all.length ? (done / all.length) * 100 : 0} color={tp.color} />
              <div className="text-xs text-subtle">{all.length - done} פתוחות · {done} הושלמו</div>
            </Link>
          );
        })}
      </div>

      <div ref={listRef} className="mt-8 scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">כל המשימות</h2>
          {kpi && <button onClick={() => setKpi(null)} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">מסונן ✕</button>}
          <div className="ms-auto flex flex-wrap items-center gap-2">
            <SegmentedControl<GroupBy> value={groupBy} onChange={(v) => { setGroupBy(v); localStorage.setItem('tm-overview-group', v); }} options={[{ value: 'time', label: 'זמן' }, { value: 'status', label: 'סטטוס' }, { value: 'topic', label: 'נושא' }]} />
            <label className="flex items-center gap-2 text-sm text-muted"><Switch checked={subs} onChange={(v) => { setSubs(v); localStorage.setItem('tm-overview-subtasks', v ? '1' : '0'); }} />כולל תתי-משימות</label>
          </div>
        </div>
        <div className="mb-3"><FilterBar page="dashboard" filters={f} onChange={setF} /></div>
        <TaskTable showTopic hideEmptySections sections={sections} />
      </div>
    </div>
  );
}
