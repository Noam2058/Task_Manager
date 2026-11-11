import { useEffect, useState } from 'react';
import type { Topic } from '@/types';
import { useAllData, useActiveWorkspaceId } from '@/lib/state';
import { createTopic, updateRow } from '@/lib/actions';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ColorPicker, IconPicker } from '@/components/ui/color-picker';
import { IconTile } from '@/components/ui/misc';

export function CreateTopicDialog({ open, onOpenChange, topic, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; topic?: Topic | null; onCreated?: (id: string) => void }) {
  const { workspaces } = useAllData();
  const activeWs = useActiveWorkspaceId();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#579BFC');
  const [icon, setIcon] = useState<string | null>('folder');
  const [ws, setWs] = useState<string>('');
  useEffect(() => {
    if (!open) return;
    setName(topic?.name ?? '');
    setColor(topic?.color ?? '#579BFC');
    setIcon(topic ? topic.icon : 'folder');
    setWs(topic?.workspace_id ?? activeWs ?? '');
  }, [open, topic, activeWs]);
  const save = () => {
    if (!name.trim() || !ws) return;
    if (topic) updateRow('topics', topic.id, { name: name.trim(), color, icon, workspace_id: ws });
    else onCreated?.(createTopic({ name: name.trim(), color, icon, workspace_id: ws }));
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogModalContent size="md">
        <DialogHeader title={topic ? 'עריכת נושא' : 'נושא חדש'} icon={<IconTile icon={icon} name={name || 'נ'} color={color} size="md" className="shadow-none" />} />
        <DialogBody className="space-y-4">
          <Field label="שם"><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="לדוגמה: פרויקט X" onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
          {workspaces.length > 1 && (
            <Field label="מרחב">
              <Select value={ws} onChange={(e) => setWs(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
            </Field>
          )}
          <Field label="צבע"><ColorPicker value={color} onChange={setColor} /></Field>
          <Field label="אייקון"><IconPicker value={icon} onChange={setIcon} color={color} /></Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>{topic ? 'שמירה' : 'יצירה'}</Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
        </DialogFooter>
      </DialogModalContent>
    </Dialog>
  );
}
