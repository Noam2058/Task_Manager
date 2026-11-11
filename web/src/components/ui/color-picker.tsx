import { Check } from 'lucide-react';
import { PALETTE } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { ICONS } from './misc';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button key={c.value} type="button" aria-label={c.name} title={c.name} onClick={() => onChange(c.value)}
          className={cn('flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110', value === c.value && 'ring-2 ring-offset-2 ring-offset-surface')}
          style={{ background: c.value, ['--tw-ring-color' as string]: c.value }}>
          {value === c.value && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}

export function IconPicker({ value, onChange, color }: { value: string | null; onChange: (i: string | null) => void; color: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
      <button type="button" onClick={() => onChange(null)} className={cn('flex h-8 w-8 items-center justify-center rounded-sm border border-dashed border-border-strong text-xs text-muted', !value && 'ring-2 ring-primary')}>א</button>
      {Object.entries(ICONS).map(([k, Icon]) => (
        <button key={k} type="button" onClick={() => onChange(k)} aria-label={k}
          className={cn('flex h-8 w-8 items-center justify-center rounded-sm transition-colors', value === k ? 'text-white' : 'text-muted hover:bg-surface-2')}
          style={value === k ? { background: color } : undefined}>
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
