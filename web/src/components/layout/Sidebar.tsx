import type * as React from 'react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Archive, BarChart3, CalendarCheck2, CalendarDays, CalendarRange, ChevronsRight, GanttChart, Inbox, LayoutDashboard,
  ListChecks, LogOut, Moon, MoreHorizontal, Pencil, Plus, Repeat2, Search, Settings, Square, Sun, SunMedium, Target, Trash2, Zap,
} from 'lucide-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUI } from '@/store/useUIStore';
import { useAllData, useCounts, useData } from '@/lib/state';
import { deleteRow, reorderRows, stopTimer, updateRow } from '@/lib/actions';
import { signOut } from '@/lib/session';
import { cn } from '@/lib/utils';
import { formatClock } from '@/lib/dates';
import { Badge, IconTile, Kbd } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/menu';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/menu';
import { confirmDialog } from '@/components/ui/confirm';
import { CreateTopicDialog } from '@/components/topics/CreateTopicDialog';
import { useTick } from '@/components/tasks/cells';
import type { Topic } from '@/types';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { SyncIndicator } from './SyncIndicator';

export function Sidebar({ mobile }: { mobile?: boolean }) {
  const collapsedPref = useUI((s) => s.sidebarCollapsed);
  const collapsed = !mobile && collapsedPref;
  const toggle = useUI((s) => s.toggleSidebar);
  const set = useUI((s) => s.set);
  const counts = useCounts();
  const { topics, tasks, profile } = useData();
  const { workspaces } = useAllData();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const darkMode = useUI((s) => s.darkMode);
  const setDark = useUI((s) => s.setDark);
  const running = tasks.find((t) => t.timer_started_at);
  useTick(!!running);
  const navigate = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const liveTopics = topics.filter((t) => !t.is_archived).sort((a, b) => a.position - b.position);
  const close = () => mobile && set({ mobileNavOpen: false });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = liveTopics.map((t) => t.id);
    reorderRows('topics', arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };

  const Item = ({ to, icon, label, count, danger, end }: { to: string; icon: React.ReactNode; label: string; count?: number; danger?: number; end?: boolean }) => (
    <Tooltip content={collapsed ? label : null} side="left">
      <NavLink to={to} end={end} onClick={close}
        className={({ isActive }) => cn('relative flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-sm font-medium transition-colors duration-[120ms] [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0',
          isActive ? 'bg-primary-soft text-primary before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-full before:bg-primary' : 'text-muted hover:bg-surface-2 hover:text-text',
          collapsed && 'justify-center px-0')}>
        {icon}
        {!collapsed && <span className="flex-1 truncate">{label}</span>}
        {!collapsed && !!danger && <Badge tone="danger">{danger}</Badge>}
        {!collapsed && !!count && <span className="text-xs text-subtle tabular">{count}</span>}
        {collapsed && (!!danger || !!count) && <span className={cn('absolute top-1.5 end-2 h-1.5 w-1.5 rounded-full', danger ? 'bg-danger' : 'bg-primary')} />}
      </NavLink>
    </Tooltip>
  );
  const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="mt-4">
      {!collapsed ? (
        <div className="mb-1 flex h-6 items-center px-2.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
          <span className="flex-1">{title}</span>{action}
        </div>
      ) : <div className="mx-3 mb-2 h-px bg-border" />}
      <div className="space-y-0.5">{children}</div>
    </div>
  );

  return (
    <aside className={cn('relative flex h-full flex-col bg-surface', !mobile && 'border-e border-border transition-[width] duration-[240ms]')}
      style={{ width: mobile ? '100%' : collapsed ? 'var(--sidebar-w-collapsed)' : 'var(--sidebar-w)' }}>
      {/* ראש */}
      <div className={cn('flex h-14 shrink-0 items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-white shadow-sm" style={{ background: 'linear-gradient(160deg,#7377F7,#4B4FE0)' }}>
          <ListChecks className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </div>
        {!collapsed && <span className="flex-1 truncate text-md font-bold">ניהול משימות</span>}
        {!mobile && !collapsed && <SyncIndicator />}
        {!mobile && (
          <button onClick={toggle} className={cn('flex h-7 w-7 items-center justify-center rounded-sm text-subtle hover:bg-surface-2 hover:text-text', collapsed && 'absolute -end-3 top-4 z-10 border border-border bg-surface shadow-sm')} aria-label="כיווץ">
            <ChevronsRight className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
          </button>
        )}
      </div>

      <div className={cn('flex-1 overflow-y-auto px-2.5 pb-3', collapsed && 'px-2')}>
        {workspaces.length > 1 && <WorkspaceSwitcher collapsed={collapsed} />}
        {/* חיפוש */}
        <button onClick={() => { close(); set({ paletteOpen: true }); }}
          className={cn('mt-2 flex h-9 w-full items-center gap-2 rounded-sm border border-border bg-surface-2/60 px-2.5 text-sm text-subtle hover:border-border-strong', collapsed && 'justify-center px-0')}>
          <Search className="h-4 w-4" />{!collapsed && <><span className="flex-1 text-start">חיפוש…</span><Kbd>Ctrl K</Kbd></>}
        </button>

        <Section title="תכנון">
          <Item to="/today" icon={<SunMedium />} label="היום" count={counts.today} danger={counts.overdue} />
          <Item to="/week" icon={<CalendarRange />} label="השבוע" />
          <Item to="/month" icon={<CalendarDays />} label="החודש" />
          <Item to="/calendar" icon={<CalendarCheck2 />} label="יומן" />
          <Item to="/inbox" icon={<Inbox />} label="תיבת נכנסים" count={counts.inbox} />
        </Section>
        <Section title="עבודה">
          <Item to="/" end icon={<LayoutDashboard />} label="לוח בקרה" />
          <Item to="/sprints" icon={<Zap />} label="ספרינטים" />
          <Item to="/timeline" icon={<GanttChart />} label="ציר זמן" />
          <Item to="/goals" icon={<Target />} label="מטרות" />
          <Item to="/habits" icon={<Repeat2 />} label="הרגלים" />
          <Item to="/review" icon={<BarChart3 />} label="סקירה שבועית" />
        </Section>
        <Section title="נושאים" action={
          <button onClick={() => setCreateOpen(true)} className="flex h-5 w-5 items-center justify-center rounded-sm hover:bg-surface-2 hover:text-text" aria-label="נושא חדש"><Plus className="h-3.5 w-3.5" /></button>
        }>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={liveTopics.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {liveTopics.map((t) => (
                <TopicItem key={t.id} topic={t} collapsed={collapsed} count={tasks.filter((x) => x.topic_id === t.id && x.status !== 'done' && !x.parent_id).length}
                  onClick={close} onEdit={() => setEditTopic(t)} />
              ))}
            </SortableContext>
          </DndContext>
          {collapsed && <button onClick={() => setCreateOpen(true)} className="flex h-9 w-full items-center justify-center rounded-sm text-subtle hover:bg-surface-2"><Plus className="h-4 w-4" /></button>}
          {!liveTopics.length && !collapsed && (
            <button onClick={() => setCreateOpen(true)} className="flex h-9 w-full items-center gap-2 rounded-sm px-2.5 text-sm text-subtle hover:bg-surface-2"><Plus className="h-4 w-4" />נושא ראשון</button>
          )}
        </Section>
      </div>

      {running && (
        <div className={cn('mx-2.5 mb-2 flex items-center gap-2 rounded bg-danger-soft p-2 text-sm', collapsed && 'mx-2 justify-center p-1.5')}>
          <button onClick={stopTimer} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger text-white" aria-label="עצירה"><Square className="h-3 w-3" fill="currentColor" /></button>
          {!collapsed && <>
            <button className="min-w-0 flex-1 truncate text-start font-medium" onClick={() => useUI.getState().openTask(running.id)}>{running.title}</button>
            <span className="tabular text-danger">{formatClock((Date.now() - new Date(running.timer_started_at!).getTime()) / 1000)}</span>
          </>}
        </div>
      )}

      {/* תחתית */}
      <div className={cn('flex shrink-0 items-center gap-2 border-t border-border p-2.5', collapsed && 'flex-col p-2')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">{(profile?.display_name || '?').charAt(0)}</div>
        {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{profile?.display_name}</div></div>}
        <Tooltip content="הגדרות"><button onClick={() => { close(); navigate('/settings'); }} className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-2" aria-label="הגדרות"><Settings className="h-4 w-4" /></button></Tooltip>
        <Tooltip content="מצב כהה/בהיר">
          <button onClick={() => setDark(document.documentElement.classList.contains('dark') ? 'light' : 'dark')} className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-2" aria-label="ערכת נושא">
            {darkMode === 'dark' || (darkMode === 'system' && document.documentElement.classList.contains('dark')) ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </Tooltip>
        <Tooltip content="התנתקות"><button onClick={() => void signOut()} className="flex h-8 w-8 items-center justify-center rounded-sm text-muted hover:bg-surface-2" aria-label="התנתקות"><LogOut className="h-4 w-4" /></button></Tooltip>
      </div>

      <CreateTopicDialog open={createOpen || !!editTopic} topic={editTopic} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditTopic(null); } }}
        onCreated={(id) => { close(); navigate(`/topics/${id}`); }} />
    </aside>
  );
}

function TopicItem({ topic, collapsed, count, onClick, onEdit }: { topic: Topic; collapsed: boolean; count: number; onClick: () => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: topic.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn('group relative', isDragging && 'z-10 opacity-70')}>
      <Tooltip content={collapsed ? topic.name : null} side="left">
        <NavLink to={`/topics/${topic.id}`} onClick={onClick} {...attributes} {...listeners}
          className={({ isActive }) => cn('flex h-9 items-center gap-2.5 rounded-sm px-2 text-sm font-medium transition-colors',
            isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-text', collapsed && 'justify-center px-0')}>
          <IconTile icon={topic.icon} name={topic.name} color={topic.color} size="sm" />
          {!collapsed && <span className="flex-1 truncate">{topic.name}</span>}
          {!collapsed && count > 0 && <span className="text-xs text-subtle tabular group-hover:opacity-0">{count}</span>}
        </NavLink>
      </Tooltip>
      {!collapsed && (
        <DropdownMenu>
          <DropdownTrigger asChild>
            <button className="absolute end-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-subtle opacity-0 hover:bg-surface-3 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="אפשרויות">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownItem icon={<Pencil />} onSelect={onEdit}>עריכה</DropdownItem>
            <DropdownItem icon={<Archive />} onSelect={() => updateRow('topics', topic.id, { is_archived: true })}>העברה לארכיון</DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={<Trash2 />} danger onSelect={async () => {
              if (await confirmDialog({ title: `למחוק את "${topic.name}"?`, description: 'הקבוצות, ההערות והמסמכים יימחקו. המשימות יישארו בלי נושא.', confirmLabel: 'מחיקה', danger: true })) deleteRow('topics', topic.id);
            }}>מחיקה</DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      )}
    </div>
  );
}
