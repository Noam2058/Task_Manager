import { Inbox as InboxIcon } from 'lucide-react';
import { useData } from '@/lib/state';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { Card, EmptyState } from '@/components/ui/misc';
import { InlineQuickAdd } from '@/components/tasks/QuickAdd';
import { FilterBar, useFilters } from '@/components/tasks/FilterBar';
import { matchesFilters, sortTasks } from '@/lib/filters';

export default function Inbox() {
  const { tasks } = useData();
  const [f, setF] = useFilters('inbox');
  const list = sortTasks(tasks.filter((t) => !t.parent_id && !t.due_date && !t.start_date && matchesFilters(t, f)), f.sort ?? 'created');
  return (
    <div>
      <PageHeader title="תיבת נכנסים" description="משימות בלי תאריך — לקלוט מהר, לתכנן אחר כך" actions={<FilterBar page="inbox" filters={f} onChange={setF} />} />
      <Card className="mb-5 p-1.5"><InlineQuickAdd defaults={{}} placeholder="רעיון, משימה, תזכורת…" autoFocus={false} /></Card>
      <TaskTable showTopic sections={[{ id: 'inbox', title: 'נכנסים', tasks: list }]}
        emptyState={<EmptyState icon={<InboxIcon />} title="התיבה ריקה" description="כל המשימות מתוכננות. כל הכבוד!" />} />
    </div>
  );
}
