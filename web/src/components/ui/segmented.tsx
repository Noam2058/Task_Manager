import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SegmentedControl<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[]; className?: string;
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded bg-surface-2 p-0.5', className)}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === 'ArrowLeft') onChange(options[(i + 1) % options.length].value);
        if (e.key === 'ArrowRight') onChange(options[(i - 1 + options.length) % options.length].value);
      }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} aria-label={o.label}
          onClick={() => onChange(o.value)} tabIndex={value === o.value ? 0 : -1}
          className={cn('inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-sm font-medium transition-all duration-[120ms] [&>svg]:h-4 [&>svg]:w-4',
            value === o.value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}>
          {o.icon}
          <span className={cn(o.icon && 'hidden md:inline')}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: {
  value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: number; icon?: ReactNode }[]; className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-border no-scrollbar', className)}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cn('relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-sm font-medium transition-colors [&>svg]:h-4 [&>svg]:w-4',
            value === t.value ? 'text-primary' : 'text-muted hover:text-text')}>
          {t.icon}{t.label}
          {t.count !== undefined && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] text-muted tabular">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
        </button>
      ))}
    </div>
  );
}
