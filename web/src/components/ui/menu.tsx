import * as DM from '@radix-ui/react-dropdown-menu';
import * as PO from '@radix-ui/react-popover';
import * as TT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const surface = 'z-50 bg-surface border border-border rounded shadow-lg p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95';

export const DropdownMenu = DM.Root;
export const DropdownTrigger = DM.Trigger;
export function DropdownContent({ children, className, align = 'end', ...p }: DM.DropdownMenuContentProps) {
  return (
    <DM.Portal>
      <DM.Content align={align} sideOffset={4} collisionPadding={8} className={cn(surface, 'min-w-[180px] max-h-[70vh] overflow-y-auto', className)} {...p}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}
export function DropdownItem({ children, icon, danger, className, ...p }: DM.DropdownMenuItemProps & { icon?: ReactNode; danger?: boolean }) {
  return (
    <DM.Item className={cn('flex h-8 items-center gap-2 rounded-sm px-2 text-sm cursor-pointer outline-none select-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50', danger ? 'text-danger' : 'text-text', className)} {...p}>
      {icon && <span className="flex h-4 w-4 items-center justify-center text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </DM.Item>
  );
}
export const DropdownSeparator = () => <DM.Separator className="my-1 h-px bg-border" />;
export const DropdownLabel = ({ children }: { children: ReactNode }) => <DM.Label className="px-2 py-1 text-xs text-subtle">{children}</DM.Label>;
export const DropdownSub = DM.Sub;
export function DropdownSubTrigger({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <DM.SubTrigger className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm cursor-pointer outline-none data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2">
      {icon && <span className="flex h-4 w-4 items-center justify-center text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      {children}
    </DM.SubTrigger>
  );
}
export function DropdownSubContent({ children }: { children: ReactNode }) {
  return <DM.Portal><DM.SubContent sideOffset={4} className={cn(surface, 'min-w-[160px] max-h-[60vh] overflow-y-auto')}>{children}</DM.SubContent></DM.Portal>;
}

export const Popover = PO.Root;
export const PopoverTrigger = PO.Trigger;
export const PopoverClose = PO.Close;
export function PopoverContent({ children, className, align = 'start', ...p }: PO.PopoverContentProps) {
  return (
    <PO.Portal>
      <PO.Content align={align} sideOffset={6} collisionPadding={8} className={cn(surface, 'p-3 outline-none', className)} {...p}>
        {children}
      </PO.Content>
    </PO.Portal>
  );
}

export const TooltipProvider = TT.Provider;
export function Tooltip({ children, content, side = 'top' }: { children: ReactNode; content: ReactNode; side?: TT.TooltipContentProps['side'] }) {
  if (!content) return <>{children}</>;
  return (
    <TT.Root>
      <TT.Trigger asChild>{children}</TT.Trigger>
      <TT.Portal>
        <TT.Content side={side} sideOffset={6} className="z-[60] rounded-sm bg-[#1B1F2E] px-2 py-1 text-xs text-white shadow-md animate-in fade-in-0 zoom-in-95">
          {content}
        </TT.Content>
      </TT.Portal>
    </TT.Root>
  );
}
