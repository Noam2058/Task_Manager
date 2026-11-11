import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '@/lib/state';
import { addDays, addMonths, endOfMonth, formatDM, MONTH_LONG, overlaps, parseDate, startOfMonth, startOfWeek, today, visibleInDateViews } from '@/lib/dates';
import { matchesFilters } from '@/lib/filters';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable, type Section } from '@/components/tasks/TaskTable';
import { FilterBar, useFilters } from '@/components/tasks/FilterBar';
import { Button } from '@/components/ui/button';

const COLORS = ['#579BFC', '#A25DDC', '#00C875', '#FDAB3D', '#FF642E', '#66CCFF'];

export default function Month() {
  const { tasks } = useData();
  const t = today();
  const [anchor, setAnchor] = useState(startOfMonth(t));
  const [f, setF] = useFilters('month');
  const end = endOfMonth(anchor);
  const sections = useMemo(() => {
    const vis = tasks.filter((x) => visibleInDateViews(x) && matchesFilters(x, f));
    const ongoing = vis.filter((x) => x.start_date && overlaps(x, anchor, end) && (!x.due_date || x.due_date < anchor || x.due_date > end));
    const out: Section[] = [{ id: `m-ongoing`, title: 'מתמשכות החודש', color: 'var(--status-progress)', tasks: ongoing, addDefaults: { start_date: anchor > t ? anchor : t } }];
    let ws = startOfWeek(anchor);
    let i = 0;
    while (ws <= end) {
      const we = addDays(ws, 6);
      const from = ws < anchor ? anchor : ws;
      const to = we > end ? end : we;
      const list = vis.filter((x) => x.due_date && x.due_date >= from && x.due_date <= to).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
      out.push({ id: `m-${from}`, title: `${formatDM(from)} – ${formatDM(to)}`, color: COLORS[i % COLORS.length], tasks: list, addDefaults: { due_date: from >= t ? from : to >= t ? t : from } });
      ws = addDays(ws, 7);
      i++;
    }
    return out;
  }, [tasks, f, anchor, end, t]);
  const d = parseDate(anchor);
  return (
    <div>
      <PageHeader title={`${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`} description="המשימות של החודש לפי שבועות"
        actions={<>
          <FilterBar page="month" filters={f} onChange={setF} hideSort />
          <div className="flex items-center gap-1">
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(addMonths(anchor, -1))} aria-label="חודש קודם"><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setAnchor(startOfMonth(t))}>היום</Button>
            <Button size="icon-sm" variant="outline" onClick={() => setAnchor(addMonths(anchor, 1))} aria-label="חודש הבא"><ChevronLeft className="h-4 w-4" /></Button>
          </div>
        </>} />
      <TaskTable showTopic sections={sections} />
    </div>
  );
}
