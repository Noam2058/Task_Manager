import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Kanban, Pencil, Table2 } from 'lucide-react';
import { useData } from '@/lib/state';
import { eachDay, formatDM, isoDate, today } from '@/lib/dates';
import { STATUS_ORDER } from '@/lib/filters';
import { STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { Card, CardHeader, ProgressBar } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented';
import { SprintDialog } from './SprintDialog';
import { timePct } from './Sprints';

export default function SprintView() {
  const { id = '' } = useParams();
  const { sprints, tasks, goals, isLoading } = useData();
  const sprint = sprints.find((s) => s.id === id);
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [edit, setEdit] = useState(false);
  const st = useMemo(() => tasks.filter((x) => x.sprint_id === id && !x.parent_id), [tasks, id]);
  const burndown = useMemo(() => {
    if (!sprint?.start_date || !sprint.end_date) return [];
    const days = eachDay(sprint.start_date, sprint.end_date);
    const total = st.length;
    const t = today();
    return days.map((d, i) => ({
      d: formatDM(d),
      ideal: Math.round((total - (total * i) / Math.max(1, days.length - 1)) * 10) / 10,
      left: d > t ? null : total - st.filter((x) => x.completed_at && isoDate(new Date(x.completed_at)) <= d).length,
    }));
  }, [sprint, st]);
  if (!sprint) return isLoading ? null : <Navigate to="/sprints" replace />;
  const done = st.filter((x) => x.status === 'done').length;
  const donePct = st.length ? (done / st.length) * 100 : 0;
  const tp = timePct(sprint);
  const goal = goals.find((g) => g.id === sprint.goal_id);
  return (
    <div>
      <PageHeader breadcrumbs={<Link to="/sprints" className="hover:text-primary">ספרינטים</Link>}
        title={<span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: sprint.color }} />{sprint.name}<Button variant="ghost" size="icon-xs" onClick={() => setEdit(true)} aria-label="עריכה"><Pencil className="h-3.5 w-3.5" /></Button></span>}
        description={<>{sprint.start_date && formatDM(sprint.start_date)} – {sprint.end_date && formatDM(sprint.end_date)}{goal && ` · מטרה: ${goal.title}`}</>}
        actions={<SegmentedControl value={view} onChange={setView} options={[{ value: 'table', label: 'טבלה', icon: <Table2 /> }, { value: 'kanban', label: 'קנבן', icon: <Kanban /> }]} />} />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="space-y-3 p-4">
          <div><div className="mb-1 flex justify-between text-sm"><span>השלמה</span><span className="tabular">{Math.round(donePct)}%</span></div><ProgressBar value={donePct} color={sprint.color} className="h-2" /></div>
          <div><div className="mb-1 flex justify-between text-sm"><span>זמן שעבר</span><span className="tabular">{Math.round(tp)}%</span></div><ProgressBar value={tp} color="var(--text-subtle)" className="h-2" /></div>
          <div className={donePct >= tp - 10 ? 'text-sm font-medium text-[var(--success)]' : 'text-sm font-medium text-danger'}>{donePct >= tp - 10 ? '✓ בקצב טוב' : '⚠ מאחורי הקצב'}</div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Burndown" />
          <div className="h-44 px-2 pb-3" dir="ltr">
            <ResponsiveContainer>
              <LineChart data={burndown}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" reversed tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} />
                <YAxis orientation="right" allowDecimals={false} width={24} tick={{ fontSize: 10, fill: 'var(--text-subtle)' }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Line dataKey="ideal" name="אידיאלי" stroke="var(--text-subtle)" strokeDasharray="4 4" dot={false} />
                <Line dataKey="left" name="נותרו" stroke={sprint.color} strokeWidth={2.5} dot={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      {view === 'table' ? (
        <TaskTable showTopic sections={STATUS_ORDER.map((s) => ({ id: `sp-${id}-${s}`, title: STATUS_LABEL[s], color: STATUS_COLOR[s], tasks: st.filter((x) => x.status === s), addDefaults: s === 'todo' ? { sprint_id: id } : undefined }))} />
      ) : <KanbanBoard tasks={st} defaults={{ sprint_id: id }} />}
      <SprintDialog open={edit} onOpenChange={setEdit} sprint={sprint} />
    </div>
  );
}
