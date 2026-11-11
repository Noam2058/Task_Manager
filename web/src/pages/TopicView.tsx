import { useMemo, useState } from 'react';
import { useParams, useSearchParams, Navigate } from 'react-router-dom';
import { Bot, CalendarDays, ChevronsDownUp, ChevronsUpDown, FileText, Folder, GanttChart, Kanban, ListTodo, Paperclip, Pencil, Plus, Table2, Upload } from 'lucide-react';
import { useData } from '@/lib/state';
import { useUI, type ViewMode } from '@/store/useUIStore';
import { insertRow } from '@/lib/actions';
import { matchesFilters, sortTasks } from '@/lib/filters';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable, type Section } from '@/components/tasks/TaskTable';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TaskCalendar } from '@/components/tasks/TaskCalendar';
import { Timeline } from '@/components/tasks/Timeline';
import { FilterBar, useFilters } from '@/components/tasks/FilterBar';
import { GroupMenu } from '@/components/topics/GroupMenu';
import { TopicDocuments, useUploader } from '@/components/topics/TopicDocuments';
import { TopicNotes } from '@/components/topics/TopicNotes';
import { AutomationsPanel } from '@/components/topics/AutomationsPanel';
import { CreateTopicDialog } from '@/components/topics/CreateTopicDialog';
import { Button } from '@/components/ui/button';
import { BatteryBar, IconTile } from '@/components/ui/misc';
import { SegmentedControl, Tabs } from '@/components/ui/segmented';
import { PALETTE } from '@/lib/colors';

type Tab = 'tasks' | 'docs' | 'notes' | 'auto';

export default function TopicView() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'tasks';
  const { topics, groups, tasks, documents, isLoading } = useData();
  const topic = topics.find((t) => t.id === id);
  const view = useUI((s) => s.viewModeByTopic[id] ?? 'table');
  const setView = useUI((s) => s.setViewMode);
  const set = useUI((s) => s.set);
  const [f, setF] = useFilters(`topic:${id}`);
  const [edit, setEdit] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploader = useUploader(id);

  const topicGroups = groups.filter((g) => g.topic_id === id).sort((a, b) => a.position - b.position);
  const topicTasks = useMemo(() => tasks.filter((t) => t.topic_id === id), [tasks, id]);
  const filtered = topicTasks.filter((t) => matchesFilters(t, f));
  const topLevel = filtered.filter((t) => !t.parent_id || !topicTasks.some((p) => p.id === t.parent_id));

  if (!topic) return isLoading ? null : <Navigate to="/" replace />;

  const sections: Section[] = topicGroups.map((g) => ({
    id: g.id, title: g.name, color: g.color, groupId: g.id, topicId: id,
    tasks: sortTasks(topLevel.filter((t) => t.group_id === g.id), f.sort ?? 'manual'),
    addDefaults: { topic_id: id, group_id: g.id }, menu: <GroupMenu group={g} />,
  }));
  const ungrouped = topLevel.filter((t) => !t.group_id || !topicGroups.some((g) => g.id === t.group_id));
  if (ungrouped.length) sections.push({ id: `${id}-nogroup`, title: 'ללא קבוצה', color: 'var(--text-subtle)', groupId: null, topicId: id, tasks: sortTasks(ungrouped, f.sort ?? 'manual') });

  const setAllCollapsed = (v: boolean) => set({ collapsedGroups: { ...useUI.getState().collapsedGroups, ...Object.fromEntries(sections.map((s) => [s.id, v])) } });
  const setTab = (t: Tab) => setParams(t === 'tasks' ? {} : { tab: t }, { replace: true });

  return (
    <div
      onDragEnter={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
      onDrop={(e) => { if (!e.dataTransfer.files.length) return; e.preventDefault(); setDragging(false); void uploader.upload(Array.from(e.dataTransfer.files)); setTab('docs'); }}
      className="relative min-h-[60vh]">
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-[1px]" onDragLeave={() => setDragging(false)}>
          <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary bg-surface px-10 py-8 text-primary shadow-lg">
            <Upload className="h-8 w-8" /><span className="font-semibold">שחררו כדי להעלות ל"{topic.name}"</span>
          </div>
        </div>
      )}
      <PageHeader
        icon={<IconTile icon={topic.icon} name={topic.name} color={topic.color} size="lg" className="hidden sm:inline-flex" />}
        title={<span className="flex items-center gap-2">{topic.name}<Button variant="ghost" size="icon-xs" onClick={() => setEdit(true)} aria-label="עריכה"><Pencil className="h-3.5 w-3.5" /></Button></span>}
        description={<span className="flex items-center gap-3"><span>{topicTasks.filter((t) => t.status !== 'done').length} פתוחות · {topicTasks.filter((t) => t.status === 'done').length} הושלמו</span><BatteryBar tasks={topicTasks} className="hidden w-32 sm:flex" /></span>}
        actions={tab === 'tasks' ? <>
          <FilterBar page={`topic:${id}`} filters={f} onChange={setF} hideTopics />
          <SegmentedControl<ViewMode> value={view} onChange={(v) => setView(id, v)} options={[
            { value: 'table', label: 'טבלה', icon: <Table2 /> }, { value: 'kanban', label: 'קנבן', icon: <Kanban /> },
            { value: 'calendar', label: 'יומן', icon: <CalendarDays /> }, { value: 'timeline', label: 'ציר זמן', icon: <GanttChart /> },
          ]} />
        </> : undefined}>
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[
          { value: 'tasks', label: 'משימות', icon: <ListTodo />, count: topicTasks.filter((t) => t.status !== 'done').length },
          { value: 'docs', label: 'מסמכים', icon: <Paperclip />, count: documents.filter((d) => d.topic_id === id).length },
          { value: 'notes', label: 'הערות', icon: <FileText /> },
          { value: 'auto', label: 'אוטומציות', icon: <Bot /> },
        ]} />
      </PageHeader>

      {tab === 'tasks' && view === 'table' && (
        <>
          <div className="mb-1 flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost" iconStart={<ChevronsUpDown className="h-4 w-4" />} onClick={() => setAllCollapsed(false)}>פתיחת הכל</Button>
            <Button size="sm" variant="ghost" iconStart={<ChevronsDownUp className="h-4 w-4" />} onClick={() => setAllCollapsed(true)}>סגירת הכל</Button>
          </div>
          <TaskTable sections={sections} draggable={(f.sort ?? 'manual') === 'manual'} />
          <Button variant="outline" className="mt-4" iconStart={<Plus className="h-4 w-4" />}
            onClick={() => insertRow('groups', { topic_id: id, name: 'קבוצה חדשה', color: PALETTE[topicGroups.length % PALETTE.length].value, position: topicGroups.length + 1, is_collapsed: false })}>
            קבוצה חדשה
          </Button>
        </>
      )}
      {tab === 'tasks' && view === 'kanban' && <KanbanBoard tasks={topLevel} defaults={{ topic_id: id }} />}
      {tab === 'tasks' && view === 'calendar' && <TaskCalendar tasks={filtered} colorBy="status" defaults={{ topic_id: id }} />}
      {tab === 'tasks' && view === 'timeline' && <Timeline tasks={filtered} />}
      {tab === 'docs' && <TopicDocuments topicId={id} uploader={uploader} />}
      {tab === 'notes' && <TopicNotes topicId={id} />}
      {tab === 'auto' && <AutomationsPanel topicId={id} />}

      <CreateTopicDialog open={edit} onOpenChange={setEdit} topic={topic} />
    </div>
  );
}

