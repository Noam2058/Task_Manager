import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useUI } from '@/store/useUIStore';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, breadcrumbs, actions, icon, children, className }: {
  title: ReactNode; description?: ReactNode; breadcrumbs?: ReactNode; actions?: ReactNode; icon?: ReactNode; children?: ReactNode; className?: string;
}) {
  const set = useUI((s) => s.set);
  return (
    <header className={cn('mb-4 md:mb-6', className)}>
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="-ms-2 md:hidden" onClick={() => set({ mobileNavOpen: true })} aria-label="תפריט"><Menu className="h-5 w-5" /></Button>
        {icon}
        <div className="min-w-0 flex-1">
          {breadcrumbs && <div className="mb-0.5 text-xs text-subtle">{breadcrumbs}</div>}
          <h1 className="truncate text-lg font-bold md:text-xl">{title}</h1>
          {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
        </div>
        {actions && <div className="hidden shrink-0 items-center gap-2 md:flex">{actions}</div>}
      </div>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2 md:hidden">{actions}</div>}
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}
