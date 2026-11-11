import type * as React from 'react';
import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, closestCenter, useSensor, useSensors,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown, ArrowUp, CalendarClock, Check, ChevronDown, ChevronLeft, GripVertical, Lock, Maximize2, Paperclip, Plus, Repeat,
} from 'lucide-react';
import type { Task } from '@/types';
import { cn } from '@/lib/utils';
import { useData } from '@/lib/state';
import { useUI, type ViewMode } from '@/store/useUIStore';
import { applyColumnSort, isBlocked, type ColumnSort } from '@/lib/filters';
import { postpone, reorderTasks, toggleComplete, updateChecklist, updateTask } from '@/lib/actions';
import { BatteryBar, DatePill, LabelChip, PriorityBadge, StatusPill } from '@/components/ui/misc';
import { Checkbox } from '@/components/ui/input';
import { CompleteButton, DateCell, ParentChip, PriorityCell, StatusCell, SubtaskBadge, TimerButton } from './cells';
import { InlineQuickAdd, type QuickAddDefaults } from './QuickAdd';

export interface Section {
  id: string;
  title: string;
  color?: string;
  tasks: Task[];
  groupId?: string | null;
  topicId?: string | null;
  addDefaults?: QuickAddDefaults | false;
  menu?: ReactNode;
  subtitle?: ReactNode;
  defaultCollapsed?: boolean;
}

interface Props {
  sections: Section[];
  showTopic?: boolean;
  draggable?: boolean;
  hideEmptySections?: boolean;
  emptyState?: ReactNode;
}

const GRID_TOPIC = 'grid-cols-[44px_minmax(0,1fr)_152px_148px_116px_128px_76px]';
const GRID = 'grid-cols-[44px_minmax(0,1fr)_148px_116px_128px_76px]';

export function TaskTable({ sections, showTopic, draggable, hideEmptySections, emptyState }: Props) {
  const [sort, setSort] = useState<ColumnSort>(null);
  const { topicById } = useData();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const canDrag = !!draggable && !sort;
  const topicName = (id: string | null) => (id ? topicById.get(id)?.name ?? '' : '');
  const sorted = useMemo(
    () => sections.map((s) => ({ ...s, tasks: applyColumnSort(s.tasks, sort, topicName) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sections, sort, topicById],
  );
  const visible = hideEmptySections ? sorted.filter((s) => s.tasks.length || s.addDefaults) : sorted;
  const allEmpty = visible.every((s) => !s.tasks.length);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const fromSec = sorted.find((s) => s.tasks.some((t) => t.id === active.id));
    const toSec = sorted.find((s) => s.id === over.data.current?.sectionId || s.id === over.id || s.tasks.some((t) => t.id === over.id));
    if (!fromSec || !toSec) return;
    if (fromSec.id === toSec.id) {
      const ids = fromSec.tasks.map((t) => t.id);
      const oldI = ids.indexOf(String(active.id));
      const newI = ids.indexOf(String(over.id));
      if (oldI === -1 || newI === -1 || oldI === newI) return;
      reorderTasks(arrayMove(ids, oldI, newI));
    } else {
      if (toSec.groupId === undefined) return;
      const ids = toSec.tasks.map((t) => t.id);
      const at = ids.indexOf(String(over.id));
      ids.splice(at === -1 ? ids.length : at, 0, String(active.id));
      reorderTasks(ids, toSec.groupId, toSec.topicId ?? null);
    }
  };

  const header = (
    <div className={cn('sticky top-0 z-10 hidden md:grid items-center border-b border-border bg-bg/90 backdrop-blur text-xs font-medium text-subtle', showTopic ? GRID_TOPIC : GRID)}>
      <div />
      <SortHeader label="משימה" k="title" sort={sort} setSort={setSort} />
      {showTopic && <SortHeader label="נושא" k="topic" sort={sort} setSort={setSort} />}
      <SortHeader label="סטטוס" k="status" sort={sort} setSort={setSort} center />
      <SortHeader label="עדיפות" k="priority" sort={sort} setSort={setSort} />
      <SortHeader label="תאריך יעד" k="due" sort={sort} setSort={setSort} />
      <div className="px-2 py-2">זמן</div>
    </div>
  );

  if (allEmpty && emptyState && !visible.some((s) => s.addDefaults)) return <>{emptyState}</>;

  const activeTask = activeId ? sorted.flatMap((s) => s.tasks).find((t) => t.id === activeId) : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="relative">
        {header}
        <div className="space-y-5 pt-3 md:space-y-6">
          {visible.map((s) => <SectionBlock key={s.id} section={s} showTopic={!!showTopic} canDrag={canDrag} />)}
        </div>
        {allEmpty && emptyState}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask && (
          <div className="rounded border border-border bg-surface px-4 py-2.5 text-sm font-medium shadow-lg">{activeTask.title}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function SortHeader({ label, k, sort, setSort, center }: { label: string; k: NonNullable<ColumnSort>['key']; sort: ColumnSort; setSort: (s: ColumnSort) => void; center?: boolean }) {
  const active = sort?.key === k;
  const next = () => setSort(!active ? { key: k, dir: 'asc' } : sort!.dir === 'asc' ? { key: k, dir: 'desc' } : null);
  return (
    <button onClick={next} className={cn('flex items-center gap-1 px-2 py-2 hover:text-text', center && 'justify-center', active && 'text-primary')}>
      {label}
      {active && (sort!.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
    </button>
  );
}

function SectionBlock({ section, showTopic, canDrag }: { section: Section; showTopic: boolean; canDrag: boolean }) {
  const collapsed = useUI((s) => s.collapsedGroups[section.id] ?? section.defaultCollapsed ?? false);
  const toggle = useUI((s) => s.toggleGroup);
  const { setNodeRef, isOver } = useDroppable({ id: section.id, data: { sectionId: section.id } });
  const color = section.color ?? 'var(--primary)';
  return (
    <section ref={setNodeRef} className={cn('animate-rise rounded', isOver && 'bg-primary-soft/40')}>
      <div className="group/sec mb-1.5 flex items-center gap-2 px-1">
        <button onClick={() => toggle(section.id)} className="flex min-w-0 items-center gap-1.5 rounded-sm py-1 pe-2 text-start hover:bg-surface-2" aria-expanded={!collapsed}>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-[180ms]', collapsed && 'rotate-90')} style={{ color }} />
          <span className="truncate text-md font-semibold" style={{ color }}>{section.title}</span>
          <span className="text-sm text-subtle tabular">{section.tasks.length}</span>
        </button>
        {section.subtitle}
        <div className="ms-auto opacity-100 md:opacity-0 md:group-hover/sec:opacity-100 transition-opacity">{section.menu}</div>
      </div>
      {!collapsed && (
        <div className="card overflow-hidden" style={{ borderInlineStart: `4px solid ${color}` }}>
          <SortableContext items={section.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy} disabled={!canDrag}>
            {section.tasks.map((t) => <Row key={t.id} task={t} showTopic={showTopic} canDrag={canDrag} sectionId={section.id} />)}
          </SortableContext>
          {section.addDefaults !== false && section.addDefaults && (
            <div className="border-t border-border">
              <InlineQuickAdd defaults={section.addDefaults} />
            </div>
          )}
          {section.tasks.length > 0 && <div className="px-3 py-2"><BatteryBar tasks={section.tasks} /></div>}
        </div>
      )}
    </section>
  );
}

const Row = memo(function Row({ task, showTopic, canDrag, sectionId }: { task: Task; showTopic: boolean; canDrag: boolean; sectionId: string }) {
  const { byId, topicById, labels } = useData();
  const openTask = useUI((s) => s.openTask);
  const selected = useUI((s) => s.selectedTaskIds.includes(task.id));
  const toggleSelected = useUI((s) => s.toggleSelected);
  const expanded = useUI((s) => !!s.expandedTasks[task.id]);
  const toggleExpanded = useUI((s) => s.toggleExpanded);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { sectionId }, disabled: !canDrag });
  const [editing, setEditing] = useState(false);
  const subtasks = useMemo(() => task.subtask_ids.map((id) => byId.get(id)).filter((t): t is Task => !!t && !t.is_archived), [task.subtask_ids, byId]);
  const parent = task.parent_id ? byId.get(task.parent_id) : undefined;
  const topic = task.topic_id ? topicById.get(task.topic_id) : parent?.topic_id ? topicById.get(parent.topic_id) : undefined;
  const blocked = isBlocked(task, byId);
  const canExpand = subtasks.length > 0 || task.checklist_total > 0;
  const taskLabels = task.labels.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as typeof labels;
  const done = task.status === 'done';

  const style = { transform: CSS.Translate.toString(transform), transition };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing || e.target !== e.currentTarget) return;
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-task-row]'));
    const i = rows.indexOf(e.currentTarget);
    if (e.key === 'Enter' || e.key === 'e') { e.preventDefault(); openTask(task.id); }
    else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); rows[i + 1]?.focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); rows[i - 1]?.focus(); }
    else if (e.key === ' ') { e.preventDefault(); void toggleComplete(task.id); }
    else if (e.key === 'x') { e.preventDefault(); toggleSelected(task.id); }
  };

  const titleBlock = (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      {canExpand ? (
        <button onClick={(e) => { e.stopPropagation(); toggleExpanded(task.id); }} aria-label={expanded ? 'סגירה' : 'פתיחה'}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-subtle hover:bg-surface-3 hover:text-text">
          <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform duration-[180ms]', expanded && '-rotate-90')} />
        </button>
      ) : <span className="hidden w-5 md:block" />}
      <CompleteButton task={task} />
      {blocked && <Lock className="h-3.5 w-3.5 shrink-0 text-warning" aria-label="חסומה" />}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {editing ? (
            <input autoFocus defaultValue={task.title}
              className="h-7 min-w-0 flex-1 rounded-sm border border-primary bg-surface px-1.5 text-base shadow-focus outline-none"
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== task.title) updateTask(task.id, { title: v }); setEditing(false); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); e.stopPropagation(); }} />
          ) : (
            <span onClick={(e) => { if (window.matchMedia('(min-width: 768px)').matches) { e.stopPropagation(); setEditing(true); } }}
              className={cn('truncate cursor-text', done && 'text-subtle line-through decoration-1')}>{task.title}</span>
          )}
          {task.recurrence_rule && <Repeat className="h-3 w-3 shrink-0 text-subtle" />}
          {!editing && <span className="hidden md:inline-flex gap-1">{taskLabels.slice(0, 3).map((l) => <LabelChip key={l.id} name={l.name} color={l.color} />)}</span>}
        </div>
        {parent && <ParentChip parent={parent} />}
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        <SubtaskBadge task={task} subtasks={subtasks} />
        {task.checklist_total > 0 && (
          <span className="inline-flex h-5 items-center gap-0.5 rounded-full bg-surface-2 px-1.5 text-[11px] text-muted tabular"><Check className="h-3 w-3" />{task.checklist_done}/{task.checklist_total}</span>
        )}
        {task.doc_count > 0 && <span className="inline-flex items-center text-[11px] text-subtle"><Paperclip className="h-3 w-3" />{task.doc_count}</span>}
        <button onClick={(e) => { e.stopPropagation(); openTask(task.id); }} className="hidden h-6 items-center gap-1 rounded-sm px-1.5 text-xs text-muted hover:bg-surface-3 group-hover/row:inline-flex" aria-label="פתיחה">
          <Maximize2 className="h-3 w-3" />פתיחה
        </button>
      </div>
    </div>
  );

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-40')}>
      {/* דסקטופ */}
      <div data-task-row data-task-id={task.id} tabIndex={0} onKeyDown={onKeyDown} onClick={() => openTask(task.id)}
        className={cn('group/row hidden md:grid min-h-[40px] cursor-pointer items-center border-b border-border last:border-b-0 transition-colors duration-[120ms] hover:bg-surface-2/70 focus:bg-primary-soft/50 focus:shadow-none',
          showTopic ? GRID_TOPIC : GRID, selected && 'bg-primary-soft/60')}>
        <div className="flex items-center justify-center gap-0.5">
          {canDrag && <span {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab text-subtle opacity-0 group-hover/row:opacity-100 active:cursor-grabbing"><GripVertical className="h-4 w-4" /></span>}
          <span className={cn('opacity-0 group-hover/row:opacity-100', selected && 'opacity-100')}><Checkbox checked={selected} onChange={() => toggleSelected(task.id)} label="בחירה" /></span>
        </div>
        <div className="flex min-w-0 items-center py-1.5 pe-2">{titleBlock}</div>
        {showTopic && (
          <div className="flex min-w-0 items-center gap-1.5 px-2 text-sm text-muted">
            {topic && <><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: topic.color }} /><span className="truncate">{topic.name}</span></>}
          </div>
        )}
        <div className="px-1.5 py-1"><StatusCell task={task} /></div>
        <div className="px-1"><PriorityCell task={task} /></div>
        <div className="px-1"><DateCell task={task} /></div>
        <div className="px-1"><TimerButton task={task} /></div>
      </div>
      {/* מובייל — עם החלקה */}
      <MobileRow task={task} topicColor={topic?.color} topicName={showTopic ? topic?.name : undefined} subtasks={subtasks} titleBlock={titleBlock} />
      {expanded && canExpand && <ExpandedRow task={task} subtasks={subtasks} />}
    </div>
  );
});

function MobileRow({ task, topicColor, topicName, subtasks, titleBlock }: { task: Task; topicColor?: string; topicName?: string; subtasks: Task[]; titleBlock: ReactNode }) {
  const openTask = useUI((s) => s.openTask);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const TH = 76;
  const end = () => {
    if (dx <= -TH) void toggleComplete(task.id);
    else if (dx >= TH) postpone([task.id], 1);
    setDx(0);
    start.current = null;
  };
  return (
    <div className="relative overflow-hidden border-b border-border last:border-b-0 md:hidden">
      {dx !== 0 && (
        <div className={cn('absolute inset-0 flex items-center px-5 text-white text-sm font-medium', dx < 0 ? 'justify-start bg-[var(--status-done)]' : 'justify-end bg-warning')}>
          {dx < 0 ? <><Check className="h-5 w-5" />&nbsp;{task.status === 'done' ? 'פתיחה' : 'הושלם'}</> : <>מחר&nbsp;<CalendarClock className="h-5 w-5" /></>}
        </div>
      )}
      <div
        onPointerDown={(e) => { if (e.pointerType !== 'mouse') start.current = { x: e.clientX, y: e.clientY, active: false }; }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.clientX - s.x; const my = e.clientY - s.y;
          if (!s.active) {
            if (Math.abs(my) > 10) { start.current = null; return; }
            if (Math.abs(mx) > 10) s.active = true;
          }
          if (s.active) setDx(Math.max(-140, Math.min(140, mx)));
        }}
        onPointerUp={end} onPointerCancel={() => { setDx(0); start.current = null; }}
        onClick={() => { if (Math.abs(dx) < 5) openTask(task.id); }}
        style={{ transform: `translateX(${dx}px)`, transition: start.current?.active ? 'none' : 'transform 200ms var(--ease)', touchAction: 'pan-y' }}
        className="relative flex min-h-[52px] items-center gap-2 bg-surface px-3 py-2 active:bg-surface-2">
        <div className="min-w-0 flex-1">
          {titleBlock}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 ps-[30px] text-xs">
            {topicName && <span className="inline-flex items-center gap-1 text-muted"><span className="h-1.5 w-1.5 rounded-full" style={{ background: topicColor }} />{topicName}</span>}
            {task.due_date && <DatePill date={task.due_date} time={task.due_time} done={task.status === 'done'} className="text-xs" />}
            {task.status !== 'todo' && task.status !== 'done' && <StatusPill status={task.status} className="h-5 text-[11px]" />}
            <SubtaskBadge task={task} subtasks={subtasks} />
            {task.checklist_total > 0 && <span className="text-subtle tabular">✓ {task.checklist_done}/{task.checklist_total}</span>}
          </div>
        </div>
        {task.priority !== 'medium' && <PriorityBadge priority={task.priority} showLabel={false} />}
        {task.timer_started_at && <TimerButton task={task} compact />}
      </div>
    </div>
  );
}

function ExpandedRow({ task, subtasks }: { task: Task; subtasks: Task[] }) {
  const openTask = useUI((s) => s.openTask);
  return (
    <div className="border-b border-border bg-surface-2/50 py-1.5 ps-10 pe-3 md:ps-[92px]">
      {subtasks.map((s) => (
        <div key={s.id} className="flex min-h-[34px] items-center gap-2 rounded-sm px-2 hover:bg-surface-3/60 cursor-pointer" onClick={() => openTask(s.id)}>
          <CompleteButton task={s} size={16} />
          <span className={cn('flex-1 truncate text-sm', s.status === 'done' && 'text-subtle line-through')}>{s.title}</span>
          <div className="hidden sm:block" onClick={(e) => e.stopPropagation()}><StatusCell task={s} variant="soft" /></div>
          <DatePill date={s.due_date} done={s.status === 'done'} className="text-xs" />
        </div>
      ))}
      {task.checklist.map((c) => (
        <label key={c.id} className="flex min-h-[30px] items-center gap-2 px-2 text-sm cursor-pointer">
          <Checkbox checked={c.is_done} onChange={(v) => updateChecklist(c.id, { is_done: v })} />
          <span className={cn(c.is_done && 'text-subtle line-through')}>{c.text}</span>
        </label>
      ))}
      <button onClick={() => openTask(task.id)} className="mt-1 flex items-center gap-1 px-2 text-xs text-primary"><Plus className="h-3 w-3" />הוספה בחלון המשימה</button>
    </div>
  );
}

export type { ViewMode };
