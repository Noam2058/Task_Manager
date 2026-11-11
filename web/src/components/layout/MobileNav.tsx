import type * as React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarCheck2, CalendarRange, Inbox, LayoutGrid, Plus, SunMedium } from 'lucide-react';
import { useUI } from '@/store/useUIStore';
import { useCounts } from '@/lib/state';
import { cn } from '@/lib/utils';

/** ניווט תחתון במובייל + כפתור + צף */
export function MobileNav() {
  const set = useUI((s) => s.set);
  const openQuickAdd = useUI((s) => s.openQuickAdd);
  const counts = useCounts();
  const item = (to: string, icon: React.ReactNode, label: string, badge?: number, danger?: boolean) => (
    <NavLink to={to} end className={({ isActive }) => cn('relative flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium [&>svg]:h-[22px] [&>svg]:w-[22px]', isActive ? 'text-primary' : 'text-subtle')}>
      {icon}{label}
      {!!badge && <span className={cn('absolute top-0.5 start-[calc(50%+6px)] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white', danger ? 'bg-danger' : 'bg-primary')}>{badge}</span>}
    </NavLink>
  );
  return (
    <>
      <button onClick={() => openQuickAdd()} aria-label="משימה חדשה"
        className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg active:scale-95 transition-transform md:hidden"
        style={{ background: 'linear-gradient(160deg,#7377F7,#4B4FE0)' }}>
        <Plus className="h-6 w-6" strokeWidth={2.6} />
      </button>
      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex h-[calc(60px+env(safe-area-inset-bottom))] border-t border-border safe-bottom md:hidden">
        {item('/today', <SunMedium />, 'היום', counts.overdue || counts.today, !!counts.overdue)}
        {item('/week', <CalendarRange />, 'שבוע')}
        {item('/calendar', <CalendarCheck2 />, 'יומן')}
        {item('/inbox', <Inbox />, 'נכנסים', counts.inbox)}
        <button onClick={() => set({ mobileNavOpen: true })} className="flex flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[10px] font-medium text-subtle [&>svg]:h-[22px] [&>svg]:w-[22px]">
          <LayoutGrid />עוד
        </button>
      </nav>
    </>
  );
}
