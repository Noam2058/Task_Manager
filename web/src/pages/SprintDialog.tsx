import { useEffect, useState } from 'react';
import type { Sprint } from '@/types';
import { useData, useActiveWorkspaceId } from '@/lib/state';
import { insertRow, updateRow } from '@/lib/actions';
import { addDays, today } from '@/lib/dates';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ColorPicker } from '@/components/ui/color-picker';

export function SprintDialog({ open, onOpenChange, sprint }: { open: boolean; onOpenChange: (o: boolean) => void; sprint?: Sprint | null }) {
  const { goals, sprints } = useData();
  const ws = useActiveWorkspaceId();
  const [v, setV] = useState({ name: '', start_date: today(), end_date: addDays(today(), 13), goal_id: '', color: '#00C875' });
  useEffect(() => {
    if (open) setV(sprint ? { name: sprint.name, start_date: sprint.start_date ?? '', end_date: sprint.end_date ?? '', goal_id: sprint.goal_id ?? '', color: sprint.color }
      : { name: `ספרינט ${sprints.length + 1}`, start_date: today(), end_date: addDays(today(), 13), goal_id: '', color: '#00C875' });
  }, [open, sprint, sprints.length]);
  const invalid = !v.name.trim() || (!!v.start_date && !!v.end_date && v.end_date < v.start_date);
  const save = () => {
    if (invalid) return;
    const row = { name: v.name.trim(), start_date: v.start_date || null, end_date: v.end_date || null, goal_id: v.goal_id || null, color: v.color };
    if (sprint) updateRow('sprints', sprint.id, row);
    else insertRow('sprints', { ...row, workspace_id: ws, topic_id: null, position: sprints.length + 1 });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogModalContent size="md">
        <DialogHeader title={sprint ? 'עריכת ספרינט' : 'ספרינט חדש'} />
        <DialogBody className="space-y-4">
          <Field label="שם"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="התחלה"><Input type="date" value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
            <Field label="סיום" error={v.end_date && v.start_date && v.end_date < v.start_date ? 'הסיום לפני ההתחלה' : undefined}><Input type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
          </div>
          <Field label="מטרה"><Select value={v.goal_id} onChange={(e) => setV({ ...v, goal_id: e.target.value })}><option value="">ללא</option>{goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</Select></Field>
          <Field label="צבע"><ColorPicker value={v.color} onChange={(c) => setV({ ...v, color: c })} /></Field>
        </DialogBody>
        <DialogFooter><Button variant="primary" disabled={invalid} onClick={save}>{sprint ? 'שמירה' : 'יצירה'}</Button><Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button></DialogFooter>
      </DialogModalContent>
    </Dialog>
  );
}
