import { useState } from 'react';
import { Flame, MoreHorizontal, Plus, Repeat2, Trash2, Archive } from 'lucide-react';
import { useData } from '@/lib/state';
import { deleteRow, insertRow, toggleHabit, updateRow } from '@/lib/actions';
import { habitStreak } from '@/lib/habits';
import { addDays, DAY_SHORT, dow, startOfWeek, today } from '@/lib/dates';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';
import { confirmDialog } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

export default function Habits() {
  const { habits, habitLogs } = useData();
  const [open, setOpen] = useState(false);
  const t = today();
  const list = habits.filter((h) => !h.is_archived);
  return (
    <div>
      <PageHeader title="הרגלים" actions={<Button variant="primary" iconStart={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>הרגל חדש</Button>} />
      {!list.length ? <EmptyState icon={<Repeat2 />} title="אין הרגלים" description="ספורט, קריאה, שתיית מים… סמן כל יום ובנה רצף." action={<Button variant="primary" onClick={() => setOpen(true)}>הרגל ראשון</Button>} /> : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((h) => {
            const dates = new Set(habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.date));
            const streak = habitStreak(h, dates, t);
            const last7 = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
            const start = addDays(startOfWeek(t), -16 * 7);
            return (
              <div key={h.id} className="card p-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: h.color }} />
                  <h3 className="flex-1 font-semibold">{h.name}</h3>
                  <span className="text-xs text-subtle">{h.frequency === 'daily' ? 'יומי' : `${h.target_per_week}× בשבוע`}</span>
                  {streak > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-[color-mix(in_srgb,#FF642E_14%,transparent)] px-2 py-0.5 text-xs font-bold text-[#FF642E]"><Flame className="h-3.5 w-3.5" />{streak}</span>}
                  <DropdownMenu>
                    <DropdownTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="אפשרויות"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem icon={<Archive />} onSelect={() => updateRow('habits', h.id, { is_archived: true })}>העברה לארכיון</DropdownItem>
                      <DropdownItem icon={<Trash2 />} danger onSelect={async () => { if (await confirmDialog({ title: 'למחוק את ההרגל וכל ההיסטוריה?', danger: true, confirmLabel: 'מחיקה' })) deleteRow('habits', h.id); }}>מחיקה</DropdownItem>
                    </DropdownContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex justify-between gap-1">
                  {last7.map((d) => {
                    const on = dates.has(d);
                    return (
                      <button key={d} onClick={() => toggleHabit(h.id, d)} className="flex flex-1 flex-col items-center gap-1">
                        <span className={cn('text-[11px]', d === t ? 'font-bold text-primary' : 'text-subtle')}>{DAY_SHORT[dow(d)]}</span>
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-all active:scale-90', on ? 'border-transparent text-white' : 'border-border text-transparent hover:border-border-strong')} style={on ? { background: h.color } : undefined}>✓</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-[3px] overflow-x-auto" dir="rtl">
                  {Array.from({ length: 17 }, (_, w) => (
                    <div key={w} className="flex flex-col gap-[3px]">
                      {Array.from({ length: 7 }, (_, d) => { const day = addDays(start, w * 7 + d); return <div key={d} title={day} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: day > t ? 'transparent' : dates.has(day) ? h.color : 'var(--surface-3)' }} />; })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <HabitDialog open={open} onOpenChange={setOpen} position={habits.length + 1} />
    </div>
  );
}

function HabitDialog({ open, onOpenChange, position }: { open: boolean; onOpenChange: (o: boolean) => void; position: number }) {
  const [v, setV] = useState({ name: '', frequency: 'daily' as 'daily' | 'weekly', target_per_week: 3, color: '#00C875' });
  const save = () => { insertRow('habits', { ...v, name: v.name.trim(), icon: null, position, is_archived: false }); onOpenChange(false); setV({ ...v, name: '' }); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogModalContent size="sm">
        <DialogHeader title="הרגל חדש" icon={<Repeat2 className="h-5 w-5" />} />
        <DialogBody className="space-y-4">
          <Field label="שם"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus placeholder="לדוגמה: ריצה" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="תדירות"><Select value={v.frequency} onChange={(e) => setV({ ...v, frequency: e.target.value as 'daily' | 'weekly' })}><option value="daily">יומי</option><option value="weekly">שבועי</option></Select></Field>
            {v.frequency === 'weekly' && <Field label="פעמים בשבוע"><Input type="number" min={1} max={7} value={v.target_per_week} onChange={(e) => setV({ ...v, target_per_week: Math.min(7, Math.max(1, Number(e.target.value))) })} /></Field>}
          </div>
          <Field label="צבע"><ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} /></Field>
        </DialogBody>
        <DialogFooter><Button variant="primary" disabled={!v.name.trim()} onClick={save}>יצירה</Button></DialogFooter>
      </DialogModalContent>
    </Dialog>
  );
}
