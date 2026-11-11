import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Plus } from 'lucide-react';
import type { Status, Task } from '@/types';
import { STATUS_ORDER } from '@/lib/filters';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { reorderTasks, updateTask } from '@/lib/actions';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { DatePill, LabelChip, PriorityBadge, ProgressBar } from '@/components/ui/misc';
import { CompleteButton, ParentChip, SubtaskBadge, TimerButton } from './cells';
import { InlineQuickAdd, type QuickAddDefaults } from './QuickAdd';
import { cn } from '@/lib/utils';

export function KanbanBoard({ tasks, defaults }: { tasks: Task[]; defaults?: QuickAddDefaults }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
  );
  const cols = useMemo(() => Object.fromEntries(STATUS_ORDER.map((s) => [s, tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position)])) as Record<Status, Task[]>, [tasks]);

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;
    const target = (STATUS_ORDER.includes(over.id as Status) ? over.id : tasks.find((t) => t.id === over.id)?.status) as Status | undefined;
    if (!target) return;
    const ids = cols[target].map((t) => t.id).filter((id) => id !== task.id);
    const at = ids.indexOf(String(over.id));
    ids.splice(at === -1 ? ids.length : at, 0, task.id);
    if (target !== task.status) updateTask(task.id, { status: target });
    reorderTasks(ids);
  };
  const active = activeId ? tasks.find((t) => t.id === activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {STATUS_ORDER.map((s) => <Column key={s} status={s} tasks={cols[s]} defaults={defaults} />)}
      </div>
      <DragOverlay dropAnimation={null}>{active && <div className="w-[280px] rotate-2"><Card task={active} overlay /></div>}</DragOverlay>
    </DndContext>
  );
}

function Column({ status, tasks, defaults }: { status: Status; tasks: Task[]; defaults?: QuickAddDefaults }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn('flex w-[82vw] shrink-0 snap-start flex-col rounded-lg bg-surface-2/70 sm:w-[300px] transition-colors', isOver && 'bg-primary-soft')}>
      <div className="h-1 rounded-t-lg" style={{ background: STATUS_COLOR[status] }} />
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[status] }} />
        <span className="font-semibold">{STATUS_LABEL[status]}</span>
        <span className="text-sm text-subtle tabular">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[60px] flex-1 flex-col gap-2 px-2 pb-2">
          {tasks.map((t) => <SortableCard key={t.id} task={t} />)}
        </div>
      </SortableContext>
      {defaults && (
        <div className="mx-2 mb-2 rounded bg-surface/70">
          <InlineQuickAdd defaults={defaults} placeholder="הוסף" />
        </div>
      )}
    </div>
  );
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners} className={cn(isDragging && 'opacity-30')}>
      <Card task={task} />
    </div>
  );
}

function Card({ task, overlay }: { task: Task; overlay?: boolean }) {
  const { labels, tasks, byId, topicById } = useData();
  const openTask = useUI((s) => s.openTask);
  const subtasks = tasks.filter((t) => t.parent_id === task.id);
  const topic = task.topic_id ? topicById.get(task.topic_id) : undefined;
  const done = task.status === 'done';
  return (
    <div onClick={() => openTask(task.id)} className={cn('card cursor-pointer p-3 transition-shadow hover:shadow-md', overlay && 'shadow-lg')}>
      <div className="flex items-start gap-2">
        <div className="pt-0.5"><CompleteButton task={task} /></div>
        <div className="min-w-0 flex-1">
          <div className={cn('text-sm font-medium leading-5', done && 'text-subtle line-through')}>{task.title}</div>
          {task.parent_id && <ParentChip parent={byId.get(task.parent_id)} />}
        </div>
        {task.priority !== 'medium' && <PriorityBadge priority={task.priority} showLabel={false} />}
      </div>
      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((id) => { const l = labels.find((x) => x.id === id); return l ? <LabelChip key={id} name={l.name} color={l.color} /> : null; })}
        </div>
      )}
      {task.checklist_total > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-subtle tabular">
          <Check className="h-3 w-3" />{task.checklist_done}/{task.checklist_total}
          <ProgressBar value={(task.checklist_done / task.checklist_total) * 100} color="var(--status-done)" className="h-1" />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {topic && <span className="inline-flex items-center gap-1 text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: topic.color }} />{topic.name}</span>}
        <SubtaskBadge task={task} subtasks={subtasks} />
        <span className="ms-auto flex items-center gap-1">
          {task.due_date && <DatePill date={task.due_date} done={done} className="text-xs" />}
          {(task.timer_started_at || task.tracked_minutes > 0) && <TimerButton task={task} compact />}
        </span>
      </div>
    </div>
  );
}


