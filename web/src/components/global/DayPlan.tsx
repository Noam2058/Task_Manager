import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Moon, Sunrise } from 'lucide-react';
import { useUI } from '@/store/useUIStore';
import { useData } from '@/lib/state';
import { updateSettings, updateTask, updateTasksWithUndo } from '@/lib/actions';
import { addDays, endOfWeek, formatMinutes, today } from '@/lib/dates';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/input';
import { DatePill, ProgressBar } from '@/components/ui/misc';
import type { Task } from '@/types';

/** פתיחה אוטומטית: תכנון בפתיחה הראשונה של היום לפני 12:00; סיכום אחרי שעת הסיכום */
export function useDayPlanAuto() {
  const { profile, tasks, isLoading } = useData();
  const set = useUI((s) => s.set);
  useEffect(() => {
    if (isLoading || !profile) return;
    const t = today();
    const s = profile.settings;
    const h = new Date().getHours();
    const open = tasks.filter((x) => x.status !== 'done' && !x.parent_id);
    if (h < 12 && s.last_plan_date !== t && open.some((x) => !x.due_date || x.due_date < t || x.due_date <= endOfWeek(t))) {
      updateSettings({ last_plan_date: t });
      set({ dayPlanOpen: 'plan' });
    } else if (h >= (s.daily_summary_hour ?? 18) && s.last_summary_date !== t && tasks.some((x) => x.due_date === t)) {
      updateSettings({ last_summary_date: t });
      set({ dayPlanOpen: 'summary' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, !!profile]);
}

export function DayPlanDialog() {
  const mode = useUI((s) => s.dayPlanOpen);
  const set = useUI((s) => s.set);
  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && set({ dayPlanOpen: null })}>
      <DialogModalContent size="md">
        {mode === 'plan' && <Plan onClose={() => set({ dayPlanOpen: null })} />}
        {mode === 'summary' && <Summary onClose={() => set({ dayPlanOpen: null })} />}
      </DialogModalContent>
    </Dialog>
  );
}

function Plan({ onClose }: { onClose: () => void }) {
  const { tasks, profile } = useData();
  const t = today();
  const [picked, setPicked] = useState<string[]>([]);
  const open = tasks.filter((x) => x.status !== 'done' && !x.is_archived);
  const todays = open.filter((x) => x.due_date === t);
  const overdue = open.filter((x) => x.due_date && x.due_date < t);
  const week = open.filter((x) => x.due_date && x.due_date > t && x.due_date <= endOfWeek(t));
  const inbox = open.filter((x) => !x.due_date && !x.start_date && !x.parent_id);
  const workday = profile?.settings.workday_minutes ?? 480;
  const planned = useMemo(() => [...todays, ...open.filter((x) => picked.includes(x.id))].reduce((s, x) => s + (x.estimate_minutes ?? 0), 0), [todays, open, picked]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const List = ({ title, items }: { title: string; items: Task[] }) => items.length ? (
    <div className="mt-4">
      <div className="mb-1 text-xs font-semibold text-subtle">{title} · {items.length}</div>
      {items.slice(0, 15).map((x) => (
        <label key={x.id} className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-sm px-2 hover:bg-surface-2">
          <Checkbox checked={picked.includes(x.id)} onChange={() => toggle(x.id)} />
          <span className="flex-1 truncate text-sm">{x.title}</span>
          {x.estimate_minutes ? <span className="text-xs text-subtle">{formatMinutes(x.estimate_minutes)}</span> : null}
          <DatePill date={x.due_date} className="text-xs" />
        </label>
      ))}
    </div>
  ) : null;
  return (
    <>
      <DialogHeader title="תכנון היום" description="בחר מה נכנס להיום" icon={<Sunrise className="h-5 w-5" />} />
      <DialogBody>
        <div className="flex items-center justify-between text-sm"><span>זמן מתוכנן</span><span className={planned > workday ? 'font-semibold text-danger tabular' : 'tabular'}>{formatMinutes(planned)} / {formatMinutes(workday)}</span></div>
        <ProgressBar value={(planned / workday) * 100} color={planned > workday ? 'var(--danger)' : 'var(--primary)'} className="mt-1.5 h-2" />
        {todays.length > 0 && <div className="mt-4 text-sm text-muted">כבר להיום: {todays.map((x) => x.title).join(' · ')}</div>}
        <List title="באיחור" items={overdue} />
        <List title="מהשבוע" items={week} />
        <List title="מתיבת הנכנסים" items={inbox} />
      </DialogBody>
      <DialogFooter>
        <Button variant="primary" disabled={!picked.length} onClick={() => { updateTasksWithUndo(picked, { due_date: t }, `${picked.length} משימות נוספו להיום`); onClose(); }} iconStart={<CalendarCheck className="h-4 w-4" />}>הוספה להיום ({picked.length})</Button>
        <Button variant="ghost" onClick={onClose}>אחר כך</Button>
      </DialogFooter>
    </>
  );
}

function Summary({ onClose }: { onClose: () => void }) {
  const { tasks } = useData();
  const t = today();
  const done = tasks.filter((x) => x.status === 'done' && x.completed_at && x.completed_at.slice(0, 10) >= addDays(t, -1) && (x.due_date === t || new Date(x.completed_at).toDateString() === new Date().toDateString()));
  const left = tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date <= t);
  const tomorrow = addDays(t, 1);
  return (
    <>
      <DialogHeader title="סיכום יום" description={`${done.length} הושלמו · ${left.length} נשארו פתוחות`} icon={<Moon className="h-5 w-5" />} />
      <DialogBody>
        {done.length > 0 && <div className="mb-4"><div className="mb-1 text-xs font-semibold text-[var(--status-done)]">הושלמו 🎉</div>{done.map((x) => <div key={x.id} className="truncate py-1 text-sm text-muted line-through">{x.title}</div>)}</div>}
        {left.length > 0 && <div><div className="mb-1 text-xs font-semibold text-subtle">נשארו פתוחות</div>
          {left.map((x) => (
            <div key={x.id} className="flex min-h-[38px] items-center gap-2 px-1">
              <span className="flex-1 truncate text-sm">{x.title}</span>
              <Button size="sm" variant="outline" onClick={() => updateTask(x.id, { due_date: tomorrow })}>למחר</Button>
            </div>
          ))}
        </div>}
        {!left.length && !done.length && <p className="text-sm text-muted">לא היו משימות להיום.</p>}
      </DialogBody>
      <DialogFooter>
        {left.length > 0 && <Button variant="primary" onClick={() => { updateTasksWithUndo(left.map((x) => x.id), { due_date: tomorrow }, 'הכל הועבר למחר'); onClose(); }}>העבר הכל למחר</Button>}
        <Button variant="ghost" onClick={onClose}>סגירה</Button>
      </DialogFooter>
    </>
  );
}
