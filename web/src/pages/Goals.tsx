import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import type { Goal } from '@/types';
import { useActiveWorkspaceId, useData } from '@/lib/state';
import { deleteRow, insertRow, updateRow } from '@/lib/actions';
import { formatRelative } from '@/lib/dates';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { Button } from '@/components/ui/button';
import { EmptyState, ProgressRing } from '@/components/ui/misc';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { confirmDialog } from '@/components/ui/confirm';

export default function Goals() {
  const { goals, tasks, sprints } = useData();
  const [dialog, setDialog] = useState<{ open: boolean; goal?: Goal }>({ open: false });
  const [expanded, setExpanded] = useState<string | null>(null);
  const goalTasks = (g: Goal) => {
    const sp = new Set(sprints.filter((s) => s.goal_id === g.id).map((s) => s.id));
    return tasks.filter((t) => !t.parent_id && (t.goal_id === g.id || (t.sprint_id && sp.has(t.sprint_id))));
  };
  return (
    <div>
      <PageHeader title="מטרות" description="רבעוניות ושנתיות — ההתקדמות מחושבת מהמשימות והספרינטים" actions={<Button variant="primary" iconStart={<Plus className="h-4 w-4" />} onClick={() => setDialog({ open: true })}>מטרה חדשה</Button>} />
      {!goals.length ? <EmptyState icon={<Target />} title="אין מטרות" description="הגדר מטרה ושייך אליה משימות או ספרינטים." action={<Button variant="primary" onClick={() => setDialog({ open: true })}>מטרה ראשונה</Button>} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((g) => {
            const gt = goalTasks(g);
            const done = gt.filter((t) => t.status === 'done').length;
            const pct = gt.length ? (done / gt.length) * 100 : 0;
            return (
              <div key={g.id} className="card p-4">
                <div className="flex items-start gap-4">
                  <ProgressRing value={pct} size={72} stroke={7} color={g.color}><span className="text-sm font-bold tabular">{Math.round(pct)}%</span></ProgressRing>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="flex-1 text-md font-semibold">{g.title}</h3>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{g.period === 'year' ? 'שנה' : 'רבעון'}</span>
                      <DropdownMenu>
                        <DropdownTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="אפשרויות"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
                        <DropdownContent>
                          <DropdownItem icon={<Pencil />} onSelect={() => setDialog({ open: true, goal: g })}>עריכה</DropdownItem>
                          <DropdownItem icon={<Trash2 />} danger onSelect={async () => { if (await confirmDialog({ title: 'למחוק את המטרה?', danger: true, confirmLabel: 'מחיקה' })) deleteRow('goals', g.id); }}>מחיקה</DropdownItem>
                        </DropdownContent>
                      </DropdownMenu>
                    </div>
                    {g.description && <p className="mt-1 text-sm text-muted">{g.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-subtle">
                      <span>{done} מתוך {gt.length} משימות</span>
                      <span>{sprints.filter((s) => s.goal_id === g.id).length} ספרינטים</span>
                      {g.target_date && <span>יעד: {formatRelative(g.target_date)}</span>}
                    </div>
                    <Button size="sm" variant="link" className="mt-1" onClick={() => setExpanded(expanded === g.id ? null : g.id)}>{expanded === g.id ? 'הסתרת משימות' : 'הצגת משימות'}</Button>
                  </div>
                </div>
                {expanded === g.id && <div className="mt-3"><TaskTable showTopic sections={[{ id: `goal-${g.id}`, title: 'משימות', color: g.color, tasks: gt, addDefaults: { goal_id: g.id } }]} /></div>}
              </div>
            );
          })}
        </div>
      )}
      <GoalDialog {...dialog} onOpenChange={(o) => setDialog({ open: o })} />
    </div>
  );
}

function GoalDialog({ open, goal, onOpenChange }: { open: boolean; goal?: Goal; onOpenChange: (o: boolean) => void }) {
  const ws = useActiveWorkspaceId();
  const [v, setV] = useState({ title: '', description: '', period: 'quarter' as Goal['period'], target_date: '', color: '#00C875' });
  const [key, setKey] = useState('');
  const k = `${open}-${goal?.id}`;
  if (k !== key) { setKey(k); setV(goal ? { title: goal.title, description: goal.description, period: goal.period, target_date: goal.target_date ?? '', color: goal.color } : { title: '', description: '', period: 'quarter', target_date: '', color: '#00C875' }); }
  const save = () => {
    const row = { ...v, title: v.title.trim(), target_date: v.target_date || null };
    if (goal) updateRow('goals', goal.id, row); else insertRow('goals', { ...row, workspace_id: ws, position: 0 });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogModalContent size="md">
        <DialogHeader title={goal ? 'עריכת מטרה' : 'מטרה חדשה'} icon={<Target className="h-5 w-5" />} />
        <DialogBody className="space-y-4">
          <Field label="כותרת"><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} autoFocus /></Field>
          <Field label="תיאור"><Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תקופה"><Select value={v.period} onChange={(e) => setV({ ...v, period: e.target.value as Goal['period'] })}><option value="quarter">רבעון</option><option value="year">שנה</option></Select></Field>
            <Field label="תאריך יעד"><Input type="date" value={v.target_date} onChange={(e) => setV({ ...v, target_date: e.target.value })} /></Field>
          </div>
          <Field label="צבע"><ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} /></Field>
        </DialogBody>
        <DialogFooter><Button variant="primary" disabled={!v.title.trim()} onClick={save}>שמירה</Button><Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button></DialogFooter>
      </DialogModalContent>
    </Dialog>
  );
}
