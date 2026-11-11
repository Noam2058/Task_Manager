import { Layers } from 'lucide-react';
import { useAllData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { cn } from '@/lib/utils';
import { IconTile } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/menu';

/** מעבר מהיר בין מרחבים: הכל / עבודה / אישי */
export function WorkspaceSwitcher({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  const { workspaces } = useAllData();
  const active = useUI((s) => s.activeWorkspace);
  const set = useUI((s) => s.set);
  const opts = [{ id: 'all', name: 'הכל', color: '#5B5FEF', icon: null as string | null }, ...workspaces];
  if (collapsed)
    return (
      <div className="flex flex-col items-center gap-1">
        {opts.map((w) => (
          <Tooltip key={w.id} content={w.name} side="left">
            <button onClick={() => set({ activeWorkspace: w.id })} className={cn('rounded-sm p-0.5', active === w.id && 'ring-2 ring-primary')}>
              {w.id === 'all' ? <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-surface-3"><Layers className="h-3.5 w-3.5" /></span> : <IconTile icon={w.icon} name={w.name} color={w.color} size="sm" />}
            </button>
          </Tooltip>
        ))}
      </div>
    );
  return (
    <div className={cn('flex rounded bg-surface-2 p-0.5', className)} role="radiogroup" aria-label="מרחב">
      {opts.map((w) => (
        <button key={w.id} role="radio" aria-checked={active === w.id} onClick={() => set({ activeWorkspace: w.id })}
          className={cn('flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm text-sm font-medium transition-all',
            active === w.id ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}>
          {w.id !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />}
          {w.name}
        </button>
      ))}
    </div>
  );
}
