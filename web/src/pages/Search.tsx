import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, FileText } from 'lucide-react';
import { useData } from '@/lib/state';
import { PageHeader } from '@/components/layout/PageHeader';
import { TaskTable } from '@/components/tasks/TaskTable';
import { Input } from '@/components/ui/input';
import { EmptyState, IconTile } from '@/components/ui/misc';

export default function Search() {
  const { tasks, topics, documents } = useData();
  const [q, setQ] = useState('');
  const s = q.trim();
  const ts = s ? tasks.filter((t) => t.title.includes(s) || t.description.includes(s)) : [];
  const tp = s ? topics.filter((t) => t.name.includes(s)) : [];
  const ds = s ? documents.filter((d) => d.filename.includes(s)) : [];
  return (
    <div>
      <PageHeader title="חיפוש" />
      <div className="relative mb-6">
        <SearchIcon className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="חיפוש משימות, נושאים, מסמכים…" className="h-12 ps-11 text-md" />
      </div>
      {!s ? <EmptyState icon={<SearchIcon />} title="מה מחפשים?" /> : (
        <div className="space-y-6">
          {tp.length > 0 && <div className="flex flex-wrap gap-2">{tp.map((t) => <Link key={t.id} to={`/topics/${t.id}`} className="card inline-flex items-center gap-2 px-3 py-2 hover:shadow-md"><IconTile icon={t.icon} name={t.name} color={t.color} />{t.name}</Link>)}</div>}
          <TaskTable showTopic sections={[{ id: 'search', title: 'משימות', tasks: ts }]} emptyState={<EmptyState compact icon={<SearchIcon />} title="לא נמצאו משימות" />} />
          {ds.length > 0 && <div className="space-y-1">{ds.map((d) => <Link key={d.id} to={`/topics/${d.topic_id}?tab=docs`} className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-surface-2"><FileText className="h-4 w-4 text-subtle" />{d.filename}</Link>)}</div>}
        </div>
      )}
    </div>
  );
}
