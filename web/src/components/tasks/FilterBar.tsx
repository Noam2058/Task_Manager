import type * as React from 'react';
import { useState } from 'react';
import { ArrowUpDown, Bookmark, Filter, Search, Trash2, X } from 'lucide-react';
import type { Filters, SortKey } from '@/types';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { activeFilterCount, PRIORITY_ORDER, STATUS_ORDER } from '@/lib/filters';
import { PRIORITY_LABEL, STATUS_LABEL } from '@/lib/strings';
import { deleteRow, insertRow } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Switch } from '@/components/ui/input';
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { Badge } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EMPTY: Filters = {};
export function useFilters(page: string, defaults: Filters = EMPTY): [Filters, (f: Filters) => void] {
  const f = useUI((s) => s.filtersByPage[page]) ?? defaults;
  const setF = useUI((s) => s.setFilters);
  return [f, (nf) => setF(page, nf)];
}

const SORTS: [SortKey, string][] = [['manual', 'ידני'], ['due', 'תאריך יעד'], ['priority', 'עדיפות'], ['title', 'שם'], ['created', 'תאריך יצירה']];
const DUE: [NonNullable<Filters['due']>[number], string][] = [['overdue', 'באיחור'], ['today', 'היום'], ['week', 'השבוע'], ['none', 'ללא תאריך']];

function toggle<T>(arr: T[] | undefined, v: T): T[] {
  const a = arr ?? [];
  return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
}

export function FilterBar({ page, filters, onChange, showSearch = true, hideTopics, hideSort }: {
  page: string; filters: Filters; onChange: (f: Filters) => void; showSearch?: boolean; hideTopics?: boolean; hideSort?: boolean;
}) {
  const { labels, topics, sprints, views } = useData();
  const count = activeFilterCount(filters);
  const pageViews = views.filter((v) => v.page === page);
  const [viewName, setViewName] = useState('');

  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div><div className="mb-1.5 text-xs font-medium text-subtle">{title}</div><div className="space-y-0.5">{children}</div></div>
  );
  const Opt = ({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) => (
    <label className="flex h-7 cursor-pointer items-center gap-2 rounded-sm px-1.5 text-sm hover:bg-surface-2">
      <Checkbox checked={checked} onChange={onToggle} />{children}
    </label>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSearch && (
        <div className="relative min-w-[140px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input value={filters.q ?? ''} onChange={(e) => onChange({ ...filters, q: e.target.value })} placeholder="חיפוש…" className="h-8 ps-8" />
        </div>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant={count ? 'primary' : 'outline'} iconStart={<Filter className="h-3.5 w-3.5" />}>
            סינון{count > 0 && <Badge tone="neutral" className="bg-white/25 text-white">{count}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(92vw,460px)]" align="end">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <Group title="סטטוס">{STATUS_ORDER.map((s) => <Opt key={s} checked={!!filters.statuses?.includes(s)} onToggle={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}>{STATUS_LABEL[s]}</Opt>)}</Group>
              <Group title="עדיפות">{PRIORITY_ORDER.map((p) => <Opt key={p} checked={!!filters.priorities?.includes(p)} onToggle={() => onChange({ ...filters, priorities: toggle(filters.priorities, p) })}>{PRIORITY_LABEL[p]}</Opt>)}</Group>
            </div>
            <div className="space-y-4">
              <Group title="תאריך יעד">{DUE.map(([v, l]) => <Opt key={v} checked={!!filters.due?.includes(v)} onToggle={() => onChange({ ...filters, due: toggle(filters.due, v) })}>{l}</Opt>)}</Group>
              {labels.length > 0 && <Group title="תווית">{labels.map((l) => <Opt key={l.id} checked={!!filters.labels?.includes(l.id)} onToggle={() => onChange({ ...filters, labels: toggle(filters.labels, l.id) })}><span className="h-2 w-2 rounded-full" style={{ background: l.color }} />{l.name}</Opt>)}</Group>}
              {!hideTopics && topics.length > 0 && <Group title="נושא">{topics.filter((t) => !t.is_archived).map((t) => <Opt key={t.id} checked={!!filters.topics?.includes(t.id)} onToggle={() => onChange({ ...filters, topics: toggle(filters.topics, t.id) })}><span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}</Opt>)}</Group>}
              {sprints.length > 0 && <Group title="ספרינט">{sprints.map((s) => <Opt key={s.id} checked={!!filters.sprints?.includes(s.id)} onToggle={() => onChange({ ...filters, sprints: toggle(filters.sprints, s.id) })}>{s.name}</Opt>)}</Group>}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm"><Switch checked={!!filters.showDone} onChange={(v) => onChange({ ...filters, showDone: v })} />הצג משימות שהושלמו</label>
            <Button size="sm" variant="ghost" onClick={() => onChange({ q: filters.q, sort: filters.sort })} disabled={!count}>ניקוי</Button>
          </div>
        </PopoverContent>
      </Popover>
      {!hideSort && (
        <DropdownMenu>
          <DropdownTrigger asChild>
            <Button size="sm" variant="outline" iconStart={<ArrowUpDown className="h-3.5 w-3.5" />}>
              <span className="hidden sm:inline">{SORTS.find(([k]) => k === (filters.sort ?? 'manual'))?.[1]}</span>
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>מיון</DropdownLabel>
            {SORTS.map(([k, l]) => <DropdownItem key={k} onSelect={() => onChange({ ...filters, sort: k })} className={cn((filters.sort ?? 'manual') === k && 'text-primary font-medium')}>{l}</DropdownItem>)}
          </DropdownContent>
        </DropdownMenu>
      )}
      <DropdownMenu>
        <DropdownTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="תצוגות שמורות"><Bookmark className="h-4 w-4" /></Button></DropdownTrigger>
        <DropdownContent className="w-64">
          <DropdownLabel>תצוגות שמורות</DropdownLabel>
          {pageViews.map((v) => (
            <DropdownItem key={v.id} onSelect={() => onChange(v.filters)} className="group">
              <span className="flex-1 truncate">{v.name}</span>
              <button onClick={(e) => { e.stopPropagation(); deleteRow('views', v.id); }} className="text-subtle opacity-0 hover:text-danger group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </DropdownItem>
          ))}
          {!pageViews.length && <div className="px-2 py-1 text-xs text-subtle">אין עדיין</div>}
          <DropdownSeparator />
          <div className="flex gap-1 p-1" onKeyDown={(e) => e.stopPropagation()}>
            <Input value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder="שם לתצוגה הנוכחית" className="h-8" />
            <Button size="sm" variant="primary" disabled={!viewName.trim()} onClick={() => { insertRow('views', { name: viewName.trim(), page, filters }); setViewName(''); toast.success('נשמר'); }}>שמירה</Button>
          </div>
        </DropdownContent>
      </DropdownMenu>
      {count > 0 && <Button size="icon-sm" variant="ghost" aria-label="ניקוי סינון" onClick={() => onChange({ q: filters.q, sort: filters.sort })}><X className="h-4 w-4" /></Button>}
    </div>
  );
}
