import { useState } from 'react';
import { MoreHorizontal, Palette, Pencil, Trash2 } from 'lucide-react';
import type { TaskGroup } from '@/types';
import { deleteRow, updateRow } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownSub, DropdownSubContent, DropdownSubTrigger, DropdownTrigger } from '@/components/ui/menu';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PALETTE } from '@/lib/colors';
import { confirmDialog } from '@/components/ui/confirm';

export function GroupMenu({ group }: { group: TaskGroup }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  return (
    <>
      <DropdownMenu>
        <DropdownTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="אפשרויות קבוצה"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
        <DropdownContent>
          <DropdownItem icon={<Pencil />} onSelect={() => { setName(group.name); setRenaming(true); }}>שינוי שם</DropdownItem>
          <DropdownSub>
            <DropdownSubTrigger icon={<Palette />}>צבע</DropdownSubTrigger>
            <DropdownSubContent>
              <div className="grid grid-cols-4 gap-1.5 p-1.5">
                {PALETTE.map((c) => <DropdownItem key={c.value} onSelect={() => updateRow('groups', group.id, { color: c.value })} className="h-7 w-7 justify-center rounded-full p-0" style={{ background: c.value }} aria-label={c.name}>{' '}</DropdownItem>)}
              </div>
            </DropdownSubContent>
          </DropdownSub>
          <DropdownSeparator />
          <DropdownItem icon={<Trash2 />} danger onSelect={async () => {
            if (await confirmDialog({ title: `למחוק את הקבוצה "${group.name}"?`, description: 'המשימות יישארו בנושא, בלי קבוצה.', confirmLabel: 'מחיקה', danger: true })) deleteRow('groups', group.id);
          }}>מחיקה</DropdownItem>
        </DropdownContent>
      </DropdownMenu>
      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogModalContent size="sm">
          <DialogHeader title="שינוי שם קבוצה" />
          <DialogBody><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { updateRow('groups', group.id, { name: name.trim() }); setRenaming(false); } }} /></DialogBody>
          <DialogFooter><Button variant="primary" disabled={!name.trim()} onClick={() => { updateRow('groups', group.id, { name: name.trim() }); setRenaming(false); }}>שמירה</Button></DialogFooter>
        </DialogModalContent>
      </Dialog>
    </>
  );
}
