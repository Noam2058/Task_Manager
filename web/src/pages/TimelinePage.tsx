import { useData } from '@/lib/state';
import { PageHeader } from '@/components/layout/PageHeader';
import { Timeline } from '@/components/tasks/Timeline';
import { FilterBar, useFilters } from '@/components/tasks/FilterBar';
import { matchesFilters } from '@/lib/filters';

export default function TimelinePage() {
  const { tasks } = useData();
  const [f, setF] = useFilters('timeline');
  return (
    <div>
      <PageHeader title="ציר זמן" description="גרור להזזה, משוך מהקצוות לשינוי התחלה/סיום" actions={<FilterBar page="timeline" filters={f} onChange={setF} hideSort />} />
      <Timeline tasks={tasks.filter((t) => matchesFilters(t, f))} />
    </div>
  );
}
