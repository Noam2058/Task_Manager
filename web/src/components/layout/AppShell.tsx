import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { useUI } from '@/store/useUIStore';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { BulkBar } from '@/components/tasks/BulkBar';
import { useOnline, usePending } from './SyncIndicator';
import { CloudOff } from 'lucide-react';

export function AppShell({ children }: { children: ReactNode }) {
  const open = useUI((s) => s.mobileNavOpen);
  const set = useUI((s) => s.set);
  const online = useOnline();
  const pending = usePending();
  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden md:block"><Sidebar /></div>
      <D.Root open={open} onOpenChange={(o) => set({ mobileNavOpen: o })}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 md:hidden data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <D.Content aria-describedby={undefined} className="fixed inset-y-0 right-0 z-50 w-[86vw] max-w-[320px] shadow-lg outline-none md:hidden data-[state=open]:animate-in data-[state=open]:slide-in-from-right safe-top">
            <D.Title className="sr-only">ניווט</D.Title>
            <Sidebar mobile />
          </D.Content>
        </D.Portal>
      </D.Root>
      <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
        {!online && (
          <div className="sticky top-0 z-20 flex items-center justify-center gap-2 bg-warning px-3 py-1.5 text-xs font-medium text-white safe-top">
            <CloudOff className="h-3.5 w-3.5" />לא מקוון — השינויים נשמרים מקומית{pending ? ` (${pending})` : ''} ויסונכרנו אוטומטית
          </div>
        )}
        <div className="mx-auto max-w-page px-4 pb-32 pt-4 safe-top md:px-6 md:pb-16 md:pt-6">{children}</div>
        <BulkBar />
      </main>
      <MobileNav />
    </div>
  );
}
