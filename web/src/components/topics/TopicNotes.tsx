import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Eye, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Note } from '@/types';
import { supabase } from '@/lib/supabase';
import { exec } from '@/lib/db';
import { newId, nowIso, cn } from '@/lib/utils';
import { timeAgo } from '@/lib/dates';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/misc';
import { confirmDialog } from '@/components/ui/confirm';

/** [[שם משימה]] → קישור שפותח את המשימה */
export function linkifyWiki(md: string, titles: Set<string>): string {
  return md.replace(/\[\[([^\]\n]{1,200})\]\]/g, (_, name: string) => {
    const n = name.trim();
    return titles.has(n) ? `[${n}](#task:${encodeURIComponent(n)})` : `~~${n}~~`;
  });
}

export function TopicNotes({ topicId }: { topicId: string }) {
  const qc = useQueryClient();
  const key = ['notes', topicId];
  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from('topic_notes').select('*').eq('topic_id', topicId).order('position');
      if (error) throw error;
      return data as Note[];
    },
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = notes.find((n) => n.id === activeId) ?? notes[0];
  const setNotes = (fn: (n: Note[]) => Note[]) => qc.setQueryData<Note[]>(key, (old) => fn(old ?? []));

  const create = () => {
    const n: Note = { id: newId(), topic_id: topicId, title: 'דף חדש', content_md: '', position: notes.length + 1, updated_at: nowIso() };
    setNotes((l) => [...l, n]);
    setActiveId(n.id);
    void exec({ t: 'insert', table: 'topic_notes', rows: [{ id: n.id, topic_id: topicId, title: n.title, content_md: '', position: n.position }] });
  };

  if (!notes.length) return <EmptyState icon={<FileText />} title="אין דפים עדיין" description="ויקי קטן לנושא — סיכומים, החלטות, קישורים. [[שם משימה]] יוצר קישור למשימה." action={<Button variant="primary" onClick={create} iconStart={<Plus className="h-4 w-4" />}>דף חדש</Button>} />;

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <aside className="flex shrink-0 gap-1 overflow-x-auto md:w-[220px] md:flex-col no-scrollbar">
        {notes.map((n) => (
          <button key={n.id} onClick={() => setActiveId(n.id)} className={cn('flex h-9 shrink-0 items-center gap-2 rounded-sm px-3 text-start text-sm', active?.id === n.id ? 'bg-primary-soft text-primary font-medium' : 'text-muted hover:bg-surface-2')}>
            <FileText className="h-4 w-4 shrink-0" /><span className="truncate">{n.title}</span>
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={create} iconStart={<Plus className="h-4 w-4" />} className="shrink-0 justify-start">דף חדש</Button>
      </aside>
      {active && <NoteEditor key={active.id} note={active} onChange={(p) => setNotes((l) => l.map((x) => (x.id === active.id ? { ...x, ...p, updated_at: nowIso() } : x)))}
        onDelete={() => { setNotes((l) => l.filter((x) => x.id !== active.id)); setActiveId(null); void exec({ t: 'delete', table: 'topic_notes', match: { id: active.id } }); }} />}
    </div>
  );
}

function NoteEditor({ note, onChange, onDelete }: { note: Note; onChange: (p: Partial<Note>) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content_md);
  const [editing, setEditing] = useState(!note.content_md);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const { tasks } = useData();
  const openTask = useUI((s) => s.openTask);
  const titles = useMemo(() => new Set(tasks.map((t) => t.title)), [tasks]);
  const save = (p: Partial<Note>) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { onChange(p); void exec({ t: 'update', table: 'topic_notes', match: { id: note.id }, patch: p }); }, 600);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="card min-w-0 flex-1 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <input value={title} onChange={(e) => { setTitle(e.target.value); save({ title: e.target.value || 'דף', content_md: content }); }} className="min-w-0 flex-1 bg-transparent text-lg font-bold focus:outline-none" />
        <span className="hidden text-xs text-subtle sm:inline">עודכן {timeAgo(note.updated_at)}</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} iconStart={editing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}>{editing ? 'תצוגה' : 'עריכה'}</Button>
        <Button size="icon-sm" variant="danger-ghost" aria-label="מחיקה" onClick={async () => { if (await confirmDialog({ title: 'למחוק את הדף?', danger: true, confirmLabel: 'מחיקה' })) onDelete(); }}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="mt-4">
        {editing ? (
          <textarea value={content} onChange={(e) => { setContent(e.target.value); save({ title, content_md: e.target.value }); }} placeholder="# כותרת&#10;כתוב כאן… Markdown נתמך. [[שם משימה]] לקישור."
            className="min-h-[50vh] w-full resize-y rounded-sm border border-border bg-surface p-3 font-mono text-sm leading-6 focus:border-primary focus:outline-none" />
        ) : (
          <div className="prose-md min-h-[200px]" onClick={(e) => {
            const a = (e.target as HTMLElement).closest('a');
            const href = a?.getAttribute('href');
            if (href?.startsWith('#task:')) {
              e.preventDefault();
              const t = tasks.find((x) => x.title === decodeURIComponent(href.slice(6)));
              if (t) openTask(t.id);
            }
          }}>
            <ReactMarkdown>{linkifyWiki(content, titles)}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
