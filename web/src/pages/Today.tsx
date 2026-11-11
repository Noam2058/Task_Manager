import { useMemo } from 'react';
import { Moon, PartyPopper, Sunrise } from 'lucide-react';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { addDays, endOfWeek, formatLong, greeting, hebrewDate, isOngoing, today, visibleInDateViews, dow } from '@/lib/dates';
import { getDayInfos } from '@/lib/hebcal';
import { toggleHabit } from '@/lib/actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { InlineQuickAdd } from '@/components/tasks/QuickAdd';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ProgressRing, SkeletonRows } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export default function Today() {
  const { tasks, habits, habitLogs, profile, isLoading } = useData();
  const set = useUI((s) => s.set);
  const t = today();
  const first = (profile?.display_name ?? '').split(' ')[0];

  const data = useMemo(() => {
    const vis = tasks.filter(visibleInDateViews);
    const open = vis.filter((x) => x.status !== 'done');
    const overdue = open.filter((x) => x.due_date && x.due_date < t);
    const todayT = vis.filter((x) => x.due_date === t);
    const ongoing = open.filter((x) => isOngoing(x, t));
    const week = open.filter((x) => x.due_date && x.due_date > t && x.due_date <= endOfWeek(t));
    const doneToday = todayT.filter((x) => x.status === 'done').length;
    const totalToday = todayT.length + ongoing.length;
    return { overdue, todayT, ongoing, week, doneToday, totalToday };
  }, [tasks, t]);

  const d = dow(t);
  const showShabbat = d >= 4;
  const shabbat = useMemo(() => {
    if (!showShabbat) return null;
    const fri = addDays(t, 5 - d);
    const infos = getDayInfos(fri, addDays(fri, 1), profile?.settings);
    return { candles: infos.get(fri)?.candles, havdalah: infos.get(addDays(fri, 1))?.havdalah, holidays: [...(infos.get(t)?.holidays ?? [])] };
  }, [t, d, showShabbat, profile?.settings]);
  const todayHolidays = useMemo(() => getDayInfos(t, t, profile?.settings).get(t)?.holidays ?? [], [t, profile?.settings]);
  const activeHabits = habits.filter((h) => !h.is_archived);
  const pct = data.totalToday ? (data.doneToday / data.totalToday) * 100 : 0;

  return (
    <div className="mx-auto max-w-dash">
      <PageHeader
        title={`${greeting()}${first ? `, ${first}` : ''}`}
        description={<>{formatLong(t)} · {hebrewDate(t)}{todayHolidays.length ? ` · ${todayHolidays.join(', ')}` : ''}</>}
        actions={<>
          <Button size="sm" variant="outline" iconStart={<Sunrise className="h-4 w-4" />} onClick={() => set({ dayPlanOpen: 'plan' })}>תכנון היום</Button>
          <Button size="sm" variant="outline" iconStart={<Moon className="h-4 w-4" />} onClick={() => set({ dayPlanOpen: 'summary' })}>סיכום יום</Button>
        </>}
      />

      <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="flex items-center gap-5 p-4">
          <ProgressRing value={pct} size={84} stroke={8} color="var(--status-done)">
            <div className="text-center"><div className="text-lg font-bold tabular">{data.doneToday}/{data.totalToday}</div></div>
          </ProgressRing>
          <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {[['באיחור', data.overdue.length, 'text-danger'], ['להיום', data.todayT.filter((x) => x.status !== 'done').length, 'text-primary'], ['בביצוע', data.ongoing.length, 'text-warning'], ['לשבוע', data.week.length, 'text-text'], ['הושלמו', data.doneToday, 'text-[var(--status-done)]']].map(([l, n, c]) => (
              <div key={l as string}><div className={cn('text-lg font-bold tabular', c as string)}>{n as number}</div><div className="text-xs text-muted">{l as string}</div></div>
            ))}
          </div>
        </Card>
        {shabbat ? (
          <Card className="flex items-center gap-4 p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, #FFCB00 12%, var(--surface)), var(--surface))' }}>
            <div className="text-3xl">🕯️</div>
            <div className="flex-1">
              <div className="font-semibold">שבת שלום · {profile?.settings.shabbat_city ?? 'חיפה'}</div>
              <div className="mt-1 flex gap-4 text-sm text-muted tabular">
                {shabbat.candles && <span>הדלקת נרות <b className="text-text">{shabbat.candles}</b></span>}
                {shabbat.havdalah && <span>הבדלה <b className="text-text">{shabbat.havdalah}</b></span>}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-1.5"><InlineQuickAdd defaults={{ due_date: t }} placeholder="מה עוד להיום? (מחר, #נושא, !גבוה…)" /></Card>
        )}
      </div>

      {activeHabits.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {activeHabits.map((h) => {
            const on = habitLogs.some((l) => l.habit_id === h.id && l.date === t);
            return (
              <button key={h.id} onClick={() => toggleHabit(h.id, t)}
                className={cn('inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-all active:scale-95', on ? 'border-transparent text-white shadow-sm' : 'border-border bg-surface text-muted')}
                style={on ? { background: h.color } : undefined}>
                <span className={cn('h-2 w-2 rounded-full', on && 'bg-white')} style={on ? undefined : { background: h.color }} />{h.name}{on && ' ✓'}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? <SkeletonRows /> : (
        <TaskTable showTopic hideEmptySections
          emptyState={<EmptyState icon={<PartyPopper />} title="היום פנוי!" description="אין משימות להיום. אפשר לתכנן מתיבת הנכנסים." action={<Button variant="primary" onClick={() => set({ dayPlanOpen: 'plan' })}>תכנון היום</Button>} />}
          sections={[
            { id: 'today-overdue', title: 'באיחור', color: 'var(--danger)', tasks: data.overdue },
            { id: 'today-today', title: 'היום', color: 'var(--primary)', tasks: data.todayT.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.due_time ?? '99').localeCompare(b.due_time ?? '99')), addDefaults: { due_date: t } },
            { id: 'today-ongoing', title: 'בביצוע (משימות מתמשכות)', color: 'var(--status-progress)', tasks: data.ongoing, addDefaults: { start_date: t } },
            { id: 'today-week', title: 'מתוכנן לשבוע', color: 'var(--text-muted)', tasks: data.week, defaultCollapsed: true },
          ]} />
      )}
    </div>
  );
}
