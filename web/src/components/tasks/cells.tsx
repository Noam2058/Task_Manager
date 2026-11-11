import type * as React from 'react';
import { useEffect, useState } from 'react';
import { Check, CornerDownLeft, ListTree, Pause, Play } from 'lucide-react';
import type { Priority, Status, Task } from '@/types';
import { cn } from '@/lib/utils';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger, Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { DatePill, PriorityBadge, StatusPill } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { STATUS_ORDER, PRIORITY_ORDER } from '@/lib/filters';
import { addDays, formatClock, nextWeekdayIso, today } from '@/lib/datesExtra';
import { setStatus, startTimer, stopTimer, toggleComplete, updateTask } from '@/lib/actions';
import { useUI } from '@/store/useUIStore';

export function StatusCell({ task, variant = 'solid' }: { task: Task; variant?: 'solid' | 'soft' }) {
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="w-full outline-none" onClick={(e) => e.stopPropagation()} aria-label="סטטוס">
          <StatusPill status={task.status} variant={variant} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="center" className="w-44 space-y-1 p-1.5">
        {STATUS_ORDER.map((s: Status) => (
          <DropdownItem key={s} onSelect={() => setStatus(task.id, s)} className="h-8 justify-center text-white font-medium data-[highlighted]:brightness-110 data-[highlighted]:bg-transparent" style={{ background: STATUS_COLOR[s] }}>
            {STATUS_LABEL[s]}
          </DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

export function PriorityCell({ task }: { task: Task }) {
  return (
    <DropdownMenu>
      <DropdownTrigger asChild>
        <button className="flex h-8 w-full items-center rounded-sm px-2 hover:bg-surface-2 outline-none" onClick={(e) => e.stopPropagation()} aria-label="עדיפות">
          <PriorityBadge priority={task.priority} />
        </button>
      </DropdownTrigger>
      <DropdownContent align="center">
        {PRIORITY_ORDER.map((p: Priority) => (
          <DropdownItem key={p} onSelect={() => updateTask(task.id, { priority: p })}><PriorityBadge priority={p} /></DropdownItem>
        ))}
      </DropdownContent>
    </DropdownMenu>
  );
}

export function DatePicker({ value, onChange, children, withTime, time, onTimeChange }: {
  value: string | null; onChange: (d: string | null) => void; children: React.ReactNode;
  withTime?: boolean; time?: string | null; onTimeChange?: (t: string | null) => void;
}) {
  const t = today();
  const quick: [string, string][] = [['היום', t], ['מחר', addDays(t, 1)], ['שבוע הבא', nextWeekdayIso(t, 0)], ['בעוד שבוע', addDays(t, 7)]];
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-1.5">
          {quick.map(([l, d]) => (
            <PopoverClose asChild key={l}>
              <Button size="sm" variant={value === d ? 'primary' : 'outline'} onClick={() => onChange(d)}>{l}</Button>
            </PopoverClose>
          ))}
        </div>
        <input type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
          className="h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none" />
        {withTime && (
          <input type="time" value={time ?? ''} onChange={(e) => onTimeChange?.(e.target.value || null)}
            className="h-9 w-full rounded-sm border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none" />
        )}
        <PopoverClose asChild>
          <Button size="sm" variant="ghost" className="w-full" onClick={() => { onChange(null); onTimeChange?.(null); }}>ללא תאריך</Button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}

export function DateCell({ task }: { task: Task }) {
  return (
    <DatePicker value={task.due_date} onChange={(d) => updateTask(task.id, { due_date: d })} withTime time={task.due_time} onTimeChange={(t) => updateTask(task.id, { due_time: t })}>
      <button className="flex h-8 w-full items-center rounded-sm px-2 hover:bg-surface-2 outline-none" onClick={(e) => e.stopPropagation()} aria-label="תאריך יעד">
        <DatePill date={task.due_date} time={task.due_time} done={task.status === 'done'} />
      </button>
    </DatePicker>
  );
}

export function CompleteButton({ task, size = 18 }: { task: Task; size?: number }) {
  const done = task.status === 'done';
  const [pop, setPop] = useState(false);
  return (
    <button aria-label={done ? 'פתיחה מחדש' : 'השלמה'} onClick={(e) => { e.stopPropagation(); setPop(true); void toggleComplete(task.id); }}
      onAnimationEnd={() => setPop(false)}
      className={cn('group/cb flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-[120ms]',
        done ? 'border-[var(--status-done)] bg-[var(--status-done)] text-white' : 'border-border-strong hover:border-[var(--status-done)] text-transparent hover:text-[var(--status-done)]',
        pop && 'animate-pop')}
      style={{ width: size, height: size }}>
      <Check style={{ width: size * 0.62, height: size * 0.62 }} strokeWidth={3.2} />
    </button>
  );
}

export function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [active]);
}

export function TimerButton({ task, compact }: { task: Task; compact?: boolean }) {
  const running = !!task.timer_started_at;
  useTick(running);
  // מציגים את זמן הריצה של הסשן הנוכחי
  const session = running ? Math.max(0, (Date.now() - new Date(task.timer_started_at!).getTime()) / 1000) : 0;
  return (
    <button onClick={(e) => { e.stopPropagation(); running ? stopTimer() : startTimer(task.id); }}
      aria-label={running ? 'עצירת טיימר' : 'הפעלת טיימר'}
      className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium tabular transition-colors',
        running ? 'bg-danger-soft text-danger' : 'text-subtle hover:bg-surface-2 hover:text-text')}>
      {running ? <Pause className="h-3.5 w-3.5" fill="currentColor" /> : <Play className="h-3.5 w-3.5" />}
      {running ? formatClock(session) : !compact && task.tracked_minutes ? `${Math.round(task.tracked_minutes)}′` : null}
    </button>
  );
}

export function SubtaskBadge({ task, subtasks }: { task: Task; subtasks: Task[] }) {
  if (!subtasks.length) return null;
  const done = subtasks.filter((s) => s.status === 'done').length;
  const t = today();
  const overdue = subtasks.some((s) => s.status !== 'done' && s.due_date && s.due_date < t);
  const dueToday = subtasks.some((s) => s.status !== 'done' && s.due_date === t);
  return (
    <span title="תתי-משימות" className={cn('inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium tabular',
      overdue ? 'bg-danger-soft text-danger' : dueToday ? 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning' : 'bg-surface-2 text-muted')}>
      <ListTree className="h-3 w-3" />{done}/{subtasks.length}
    </span>
  );
  void task;
}

export function ParentChip({ parent }: { parent: Task | undefined }) {
  if (!parent) return null;
  return (
    <button onClick={(e) => { e.stopPropagation(); useUI.getState().openTask(parent.id); }}
      className="inline-flex max-w-[160px] items-center gap-0.5 truncate text-xs text-subtle hover:text-primary">
      <CornerDownLeft className="h-3 w-3 shrink-0" /><span className="truncate">{parent.title}</span>
    </button>
  );
}
