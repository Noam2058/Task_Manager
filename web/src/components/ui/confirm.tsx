import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { create } from 'zustand';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogModalContent } from './dialog';
import { Button } from './button';

interface ConfirmOpts { title: string; description?: string; confirmLabel?: string; danger?: boolean }
const useConfirm = create<{ opts: ConfirmOpts | null; resolve: ((v: boolean) => void) | null }>(() => ({ opts: null, resolve: null }));

export function confirmDialog(opts: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ opts, resolve }));
}

export function ConfirmDialogHost() {
  const { opts, resolve } = useConfirm();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(!!opts), [opts]);
  const close = (v: boolean) => { resolve?.(v); useConfirm.setState({ opts: null, resolve: null }); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(false)}>
      <DialogModalContent size="sm">
        {opts && <>
          <DialogHeader title={opts.title} icon={<AlertTriangle className={opts.danger ? 'h-5 w-5 text-danger' : 'h-5 w-5'} />} onClose={false} />
          {opts.description && <DialogBody><p className="text-sm text-muted">{opts.description}</p></DialogBody>}
          <DialogFooter>
            <Button variant={opts.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{opts.confirmLabel ?? 'אישור'}</Button>
            <Button variant="ghost" onClick={() => close(false)}>ביטול</Button>
          </DialogFooter>
        </>}
      </DialogModalContent>
    </Dialog>
  );
}
