import { useState } from 'react';
import { Lock, Plus, X } from 'lucide-react';
import type { Task } from '@/types';
import { useData } from '@/lib/state';
import { addDependency, removeDependency } from '@/lib/actions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/useUIStore';

export function DependencyEditor({ task }: { task: Task }) {
  const { byId, tasks } = useData();
  const openTask = useUI((s) => s.openTask);
  const [q, setQ] = useState('');
  const deps = task.depends_on.map((id) => byId.get(id)).filter(Boolean) as Task[];
  const blocking = tasks.filter((t) => t.depends_on.includes(task.id));
  const candidates = tasks
    .filter((t) => t.id !== task.id && !task.depends_on.includes(t.id) && t.status !== 'done' && t.title.includes(q.trim()))
    .slice(0, 12);
  return (
    <div className="space-y-1">
      {deps.map((d) => (
        <div key={d.id} className="flex items-center gap-1.5 text-sm">
          <Lock className={cn('h-3.5 w-3.5', d.status === 'done' ? 'text-[var(--status-done)]' : 'text-warning')} />
          <button onClick={() => openTask(d.id)} className={cn('truncate hover:text-primary', d.status === 'done' && 'text-subtle line-through')}>{d.title}</button>
          <button onClick={() => removeDependency(task.id, d.id)} className="text-subtle hover:text-danger" aria-label="הסרה"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {blocking.length > 0 && <div className="text-xs text-subtle">חוסמת את: {blocking.map((b) => b.title).join(', ')}</div>}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-7 items-center gap-1 rounded-sm px-2 text-sm text-subtle hover:bg-surface-2 hover:text-text"><Plus className="h-3.5 w-3.5" />תלויה ב…</button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש משימה…" className="mb-1 h-8" autoFocus />
          <div className="max-h-60 overflow-y-auto">
            {candidates.map((c) => (
              <button key={c.id} onClick={() => { void addDependency(task.id, c.id); setQ(''); }} className="block w-full truncate rounded-sm px-2 py-1.5 text-start text-sm hover:bg-surface-2">{c.title}</button>
            ))}
            {!candidates.length && <div className="px-2 py-2 text-xs text-subtle">לא נמצאו משימות</div>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
