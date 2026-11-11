import type * as React from 'react';
import { useMemo } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useData } from '@/lib/state';
import { addDays, formatDM, isoDate, startOfWeek, today } from '@/lib/dates';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { Card } from '@/components/ui/misc';

export default function Review() {
  const { tasks } = useData();
  const t = today();
  const ws = startOfWeek(t);
  const d = useMemo(() => ({
    done: tasks.filter((x) => x.completed_at && isoDate(new Date(x.completed_at)) >= ws),
    stuck: tasks.filter((x) => x.status === 'stuck'),
    overdue: tasks.filter((x) => x.status !== 'done' && x.due_date && x.due_date < t),
  }), [tasks, ws, t]);
  const box = (icon: React.ReactNode, label: string, n: number, color: string) => (
    <Card className="flex items-center gap-3 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{icon}</span><div><div className="text-2xl font-bold tabular">{n}</div><div className="text-sm text-muted">{label}</div></div></Card>
  );
  return (
    <div className="mx-auto max-w-dash">
      <PageHeader title="סקירה שבועית" description={`${formatDM(ws)} – ${formatDM(addDays(ws, 6))} · מה הלך טוב, מה תקוע, מה לדחות`} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {box(<CheckCircle2 />, 'הושלמו השבוע', d.done.length, 'var(--status-done)')}
        {box(<AlertOctagon />, 'תקועות', d.stuck.length, 'var(--status-stuck)')}
        {box(<AlertTriangle />, 'באיחור', d.overdue.length, 'var(--warning)')}
      </div>
      <TaskTable showTopic hideEmptySections sections={[
        { id: 'rv-stuck', title: 'תקועות', color: 'var(--status-stuck)', tasks: d.stuck },
        { id: 'rv-overdue', title: 'באיחור', color: 'var(--warning)', tasks: d.overdue },
        { id: 'rv-done', title: 'הושלמו השבוע', color: 'var(--status-done)', tasks: d.done },
      ]} />
    </div>
  );
}
