import { useData } from '@/lib/state';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskCalendar } from '@/components/tasks/TaskCalendar';
import { visibleInDateViews } from '@/lib/dates';

export default function CalendarPage() {
  const { tasks } = useData();
  return (
    <div>
      <PageHeader title="יומן" description="גרור משימות בין ימים · לחיצה על יום יוצרת משימה" />
      <TaskCalendar tasks={tasks.filter(visibleInDateViews)} />
    </div>
  );
}
