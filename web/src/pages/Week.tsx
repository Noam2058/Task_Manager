import type * as React from 'react';
import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { Task } from '@/types';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { addDays, DAY_LONG, eachDay, parseDate, formatDM, hebrewDay, isOngoing, overlaps, startOfWeek, today, visibleInDateViews, endOfWeek } from '@/lib/dates';
import { getDayInfos, isShabbat } from '@/lib/hebcal';
import { updateTask } from '@/lib/actions';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { DatePill, PriorityBadge } from '@/components/ui/misc';
import { CompleteButton } from '@/components/tasks/cells';
import { confirmDialog } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/dates';

const NO_DAY = 'none';

export default function Week() {
  const { tasks, profile, topicById } = useData();
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const t = today();
  const [anchor, setAnchor] = useState(startOfWeek(t));
  const days = eachDay(anchor, addDays(anchor, 6));
  const infos = useMemo(() => getDayInfos(anchor, addDays(anchor, 6), profile?.settings), [anchor, profile?.settings]);
  const workday = profile?.settings.workday_minutes ?? 480;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }));

  const vis = tasks.filter(visibleInDateViews);
  const ongoing = vis.filter((x) => x.status !== 'done' && x.start_date && x.start_date < (x.due_date ?? '9999') && overlaps(x, anchor, addDays(anchor, 6)) && !(x.due_date && x.due_date >= anchor && x.due_date <= addDays(anchor, 6) && x.start_date === x.due_date));
  const byDay = (d: string) => vis.filter((x) => x.due_date === d).sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (a.due_time ?? '99').localeCompare(b.due_time ?? '99'));
  const noDay = vis.filter((x) => !x.due_date && x.plan_period === 'week' && x.plan_anchor === anchor);

  const onEnd = async (e: DragEndEvent) => {
    const id = String(e.active.id);
    const target = e.over?.id ? String(e.over.id) : null;
    const task = tasks.find((x) => x.id === id);
    if (!task || !target) return;
    if (target === NO_DAY) return updateTask(id, { due_date: null, plan_period: 'week', plan_anchor: anchor });
    if (task.due_date === target) return;
    if (isShabbat(target) || infos.get(target)?.isYomTov) {
      const ok = await confirmDialog({ title: 'להעביר לשבת/חג?', description: `${DAY_LONG[parseDate(target).getDay()]} ${formatDM(target)} הוא שבת או חג.`, confirmLabel: 'להעביר' });
      if (!ok) return;
    }
    updateTask(id, { due_date: target, plan_period: 'none', plan_anchor: null });
  };

  return (
    <div>
      <PageHeader title="השבוע" description={`${formatDM(anchor)} – ${formatDM(endOfWeek(anchor))}`}
        actions={
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="שבוע קודם"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(startOfWeek(t))}>היום</Button>
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="שבוע הבא"><ChevronLeft className="h-4 w-4" /></Button>
          </div>
        } />

      <div className="card mb-4 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-warning">מתמשכות השבוע</span>
          <span className="text-xs text-subtle">{ongoing.length}</span>
          <Button size="icon-xs" variant="ghost" className="ms-auto" aria-label="הוספה" onClick={() => openQuickAdd({ start_date: anchor < t ? t : anchor })}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {ongoing.map((x) => <MiniCard key={x.id} task={x} color={topicById.get(x.topic_id ?? '')?.color} />)}
          {!ongoing.length && <span className="text-xs text-subtle">אין משימות מתמשכות</span>}
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onEnd}>
        <div className="flex flex-col gap-3 md:grid md:grid-cols-8 md:gap-2 md:overflow-x-auto">
          {days.map((d) => {
            const list = byDay(d);
            const info = infos.get(d);
            const load = list.filter((x) => x.status !== 'done').reduce((s, x) => s + (x.estimate_minutes ?? 0), 0);
            const pct = (load / workday) * 100;
            const special = isShabbat(d) || info?.isYomTov;
            return (
              <DayColumn key={d} id={d} className={cn(d === t && 'ring-2 ring-primary', special && 'bg-surface-2/80')}>
                <div className="mb-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('font-semibold', d === t && 'text-primary')}>{DAY_LONG[parseDate(d).getDay()]}</span>
                    <span className="text-xs text-subtle tabular">{formatDM(d)} · {hebrewDay(d)}</span>
                    <Button size="icon-xs" variant="ghost" className="ms-auto" aria-label="הוספה" onClick={() => openQuickAdd({ due_date: d })}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                  {info?.holidays.map((h) => <div key={h} className="truncate text-[11px] text-primary">{h}</div>)}
                  {info?.candles && <div className="text-[11px] text-subtle">🕯 {info.candles}</div>}
                  {info?.havdalah && <div className="text-[11px] text-subtle">✨ {info.havdalah}</div>}
                  {load > 0 && (
                    <div className="mt-1.5" title={`${formatMinutes(load)} מתוך ${formatMinutes(workday)}`}>
                      <div className="h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? 'var(--danger)' : pct > 75 ? 'var(--warning)' : 'var(--status-done)' }} /></div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {list.map((x) => <DraggableCard key={x.id} task={x} color={topicById.get(x.topic_id ?? '')?.color} />)}
                </div>
              </DayColumn>
            );
          })}
          <DayColumn id={NO_DAY}>
            <div className="mb-2 flex items-center"><span className="font-semibold text-muted">ללא יום</span>
              <Button size="icon-xs" variant="ghost" className="ms-auto" aria-label="הוספה" onClick={() => openQuickAdd({})}><Plus className="h-3.5 w-3.5" /></Button></div>
            <div className="flex flex-col gap-1.5">{noDay.map((x) => <DraggableCard key={x.id} task={x} color={topicById.get(x.topic_id ?? '')?.color} />)}</div>
          </DayColumn>
        </div>
      </DndContext>
    </div>
  );
}

function DayColumn({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={cn('card min-h-[80px] p-2.5 md:min-h-[320px] md:min-w-[150px]', isOver && 'bg-primary-soft', className)}>{children}</div>;
}

function DraggableCard({ task, color }: { task: Task; color?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const openTask = useUI((s) => s.openTask);
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => openTask(task.id)}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined, borderInlineStartColor: color ?? 'var(--border-strong)' }}
      className={cn('cursor-pointer rounded-sm border border-border border-s-[3px] bg-surface p-2 text-sm shadow-xs hover:shadow-sm', isDragging && 'z-50 shadow-lg opacity-90')}>
      <div className="flex items-start gap-1.5">
        <CompleteButton task={task} size={16} />
        <span className={cn('min-w-0 flex-1 leading-5', task.status === 'done' && 'text-subtle line-through')}>{task.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 ps-[22px] text-[11px] text-subtle">
        {task.due_time && <span className="tabular">{task.due_time}</span>}
        {task.priority !== 'medium' && <PriorityBadge priority={task.priority} showLabel={false} className="[&>svg]:h-3 [&>svg]:w-3" />}
        {task.estimate_minutes ? <span>{formatMinutes(task.estimate_minutes)}</span> : null}
      </div>
    </div>
  );
}

function MiniCard({ task, color }: { task: Task; color?: string }) {
  const openTask = useUI((s) => s.openTask);
  return (
    <button onClick={() => openTask(task.id)} className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm hover:bg-surface-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color ?? 'var(--warning)' }} />
      <span className="truncate">{task.title}</span>
      {task.due_date && <DatePill date={task.due_date} className="text-xs" />}
    </button>
  );
}

