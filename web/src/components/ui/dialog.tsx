import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlay = 'fixed inset-0 z-40 bg-[#0B0D14]/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0';

export function DialogModalContent({ children, size = 'md', className, ...p }: D.DialogContentProps & { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content
        className={cn(
          'fixed z-50 flex flex-col bg-surface shadow-lg outline-none',
          // מובייל: גיליון תחתון. דסקטופ: חלון ממורכז
          'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl animate-sheet-up safe-bottom',
          'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[720px] sm:rounded-lg sm:animate-in sm:fade-in-0 sm:zoom-in-95 sm:w-[calc(100vw-32px)]',
          size === 'sm' && 'sm:max-w-[420px]', size === 'md' && 'sm:max-w-[560px]', size === 'lg' && 'sm:max-w-[760px]', className,
        )}
        aria-describedby={undefined}
        {...p}>
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong sm:hidden" />
        {children}
      </D.Content>
    </D.Portal>
  );
}

export function DialogHeader({ title, description, icon, onClose }: { title: ReactNode; description?: ReactNode; icon?: ReactNode; onClose?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-5 pt-4 pb-3">
      {icon && <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div>}
      <div className="min-w-0 flex-1">
        <D.Title className="text-md font-semibold">{title}</D.Title>
        {description && <D.Description className="mt-0.5 text-sm text-muted">{description}</D.Description>}
      </div>
      {onClose !== false && (
        <D.Close asChild><Button variant="ghost" size="icon-sm" aria-label="סגירה"><X className="h-4 w-4" /></Button></D.Close>
      )}
    </div>
  );
}

export const DialogBody = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex-1 overflow-y-auto px-5 pb-4', className)}>{children}</div>
);
export const DialogFooter = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('flex items-center justify-start gap-2 border-t border-border px-5 py-3', className)}>{children}</div>
);

/** מגירה מקצה ה-end (שמאל ב-RTL), מסך מלא במובייל */
export function DialogDrawerContent({ children, className, ...p }: D.DialogContentProps) {
  return (
    <D.Portal>
      <D.Overlay className={overlay} />
      <D.Content aria-describedby={undefined}
        className={cn('fixed inset-y-0 left-0 z-50 flex w-full flex-col bg-surface shadow-lg outline-none sm:w-[560px] animate-drawer-in safe-top', className)} {...p}>
        {children}
      </D.Content>
    </D.Portal>
  );
}
export const DialogTitle = D.Title;
