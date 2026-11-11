import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import type { Sprint } from '@/types';
import { useData } from '@/lib/state';
import { deleteRow } from '@/lib/actions';
import { diffDays, formatDM, today } from '@/lib/dates';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { BatteryBar, EmptyState, ProgressBar } from '@/components/ui/misc';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/menu';
import { confirmDialog } from '@/components/ui/confirm';
import { SprintDialog } from './SprintDialog';

export function sprintPhase(s: Sprint, t = today()): 'active' | 'future' | 'done' {
  if (s.start_date && s.start_date > t) return 'future';
  if (s.end_date && s.end_date < t) return 'done';
  return 'active';
}
export function timePct(s: Sprint, t = today()) {
  if (!s.start_date || !s.end_date) return 0;
  const total = diffDays(s.end_date, s.start_date) + 1;
  return Math.min(100, Math.max(0, ((diffDays(t, s.start_date) + 1) / total) * 100));
}
const PHASE = { active: ['פעיל', 'var(--status-done)'], future: ['עתידי', '#579BFC'], done: ['הסתיים', 'var(--text-subtle)'] } as const;

export default function Sprints() {
  const { sprints, tasks } = useData();
  const [dialog, setDialog] = useState<{ open: boolean; sprint?: Sprint | null }>({ open: false });
  const t = today();
  const order = { active: 0, future: 1, done: 2 };
  const list = [...sprints].sort((a, b) => order[sprintPhase(a)] - order[sprintPhase(b)] || (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  return (
    <div>
      <PageHeader title="ספרינטים" actions={<Button variant="primary" iconStart={<Plus className="h-4 w-4" />} onClick={() => setDialog({ open: true })}>ספרינט חדש</Button>} />
      {!list.length ? <EmptyState icon={<Zap />} title="אין ספרינטים" description="ספרינט = פרק זמן עם יעד. שייך אליו משימות ועקוב אחרי הקצב." action={<Button variant="primary" onClick={() => setDialog({ open: true })}>ספרינט ראשון</Button>} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => {
            const st = tasks.filter((x) => x.sprint_id === s.id && !x.parent_id);
            const done = st.filter((x) => x.status === 'done').length;
            const ph = sprintPhase(s, t);
            const left = s.end_date ? diffDays(s.end_date, t) : null;
            return (
              <div key={s.id} className="card relative overflow-hidden">
                <div className="h-1.5" style={{ background: s.color }} />
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <Link to={`/sprints/${s.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-md font-semibold hover:text-primary">{s.name}</div>
                      <div className="mt-0.5 text-xs text-subtle tabular">{s.start_date ? formatDM(s.start_date) : '?'} – {s.end_date ? formatDM(s.end_date) : '?'}</div>
                    </Link>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${PHASE[ph][1]} 15%, transparent)`, color: PHASE[ph][1] }}>{PHASE[ph][0]}</span>
                    <DropdownMenu>
                      <DropdownTrigger asChild><Button size="icon-xs" variant="ghost" aria-label="אפשרויות"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
                      <DropdownContent>
                        <DropdownItem icon={<Pencil />} onSelect={() => setDialog({ open: true, sprint: s })}>עריכה</DropdownItem>
                        <DropdownItem icon={<Trash2 />} danger onSelect={async () => { if (await confirmDialog({ title: `למחוק את "${s.name}"?`, description: 'המשימות יישארו.', danger: true, confirmLabel: 'מחיקה' })) deleteRow('sprints', s.id); }}>מחיקה</DropdownItem>
                      </DropdownContent>
                    </DropdownMenu>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-muted">
                    <div className="flex justify-between"><span>השלמה</span><span className="tabular">{done}/{st.length}</span></div>
                    <ProgressBar value={st.length ? (done / st.length) * 100 : 0} color={s.color} />
                    {ph === 'active' && <><div className="flex justify-between"><span>זמן שעבר</span><span>{left !== null && left >= 0 ? `נותרו ${left} ימים` : ''}</span></div><ProgressBar value={timePct(s, t)} color="var(--text-subtle)" /></>}
                    <BatteryBar tasks={st} className="mt-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <SprintDialog open={dialog.open} sprint={dialog.sprint} onOpenChange={(o) => setDialog({ open: o })} />
    </div>
  );
}
