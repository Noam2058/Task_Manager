import { useEffect } from 'react';
import { Archive, CalendarDays, CircleDot, Flag, Trash2, X } from 'lucide-react';
import { useUI } from '@/store/useUIStore';
import { archiveTasks, deleteTasks, updateTasksWithUndo } from '@/lib/actions';
import { PRIORITY_ORDER, STATUS_ORDER } from '@/lib/filters';
import { PRIORITY_LABEL, STATUS_COLOR, STATUS_LABEL } from '@/lib/strings';
import { addDays, today } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownTrigger } from '@/components/ui/menu';
import { PriorityBadge } from '@/components/ui/misc';

export function BulkBar() {
  const ids = useUI((s) => s.selectedTaskIds);
  const clear = useUI((s) => s.clearSelection);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ids.length && clear();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids.length, clear]);
  if (!ids.length) return null;
  const done = () => clear();
  const t = today();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-3 md:bottom-6">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-1.5 shadow-lg animate-rise">
        <span className="px-2 text-sm font-semibold tabular">{ids.length} נבחרו</span>
        <DropdownMenu>
          <DropdownTrigger asChild><Button size="sm" variant="ghost" iconStart={<CircleDot className="h-4 w-4" />}><span className="hidden sm:inline">סטטוס</span></Button></DropdownTrigger>
          <DropdownContent align="center">{STATUS_ORDER.map((s) => <DropdownItem key={s} onSelect={() => { updateTasksWithUndo(ids, { status: s }, `${ids.length} משימות עודכנו`); done(); }}><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />{STATUS_LABEL[s]}</DropdownItem>)}</DropdownContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownTrigger asChild><Button size="sm" variant="ghost" iconStart={<Flag className="h-4 w-4" />}><span className="hidden sm:inline">עדיפות</span></Button></DropdownTrigger>
          <DropdownContent align="center">{PRIORITY_ORDER.map((p) => <DropdownItem key={p} onSelect={() => { updateTasksWithUndo(ids, { priority: p }, `${ids.length} משימות עודכנו`); done(); }}><PriorityBadge priority={p} /></DropdownItem>)}</DropdownContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownTrigger asChild><Button size="sm" variant="ghost" iconStart={<CalendarDays className="h-4 w-4" />}><span className="hidden sm:inline">תאריך</span></Button></DropdownTrigger>
          <DropdownContent align="center">
            {[['היום', t], ['מחר', addDays(t, 1)], ['בעוד שבוע', addDays(t, 7)], ['ללא תאריך', null]].map(([l, d]) => (
              <DropdownItem key={String(l)} onSelect={() => { updateTasksWithUndo(ids, { due_date: d }, `${ids.length} משימות עודכנו`); done(); }}>{l}</DropdownItem>
            ))}
          </DropdownContent>
        </DropdownMenu>
        <Button size="icon-sm" variant="ghost" aria-label="ארכיון" onClick={() => { archiveTasks(ids); done(); }}><Archive className="h-4 w-4" /></Button>
        <Button size="icon-sm" variant="danger-ghost" aria-label="מחיקה" onClick={() => { deleteTasks(ids); done(); }}><Trash2 className="h-4 w-4" /></Button>
        <Button size="icon-sm" variant="ghost" aria-label="ניקוי בחירה" onClick={clear}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

