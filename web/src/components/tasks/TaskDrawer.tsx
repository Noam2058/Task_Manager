import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Archive, ArrowRight, Bell, CalendarDays, CalendarRange, Clock, Copy, Crosshair, Eye, Flag, FolderOpen, GitBranch,
  History, Link2, ListChecks, MoreHorizontal, Paperclip, Pencil, Plus, Repeat, Tag, Target, Timer, Trash2, Upload, X, Zap, CircleDot,
} from 'lucide-react';
import type { Task } from '@/types';
import { useUI } from '@/store/useUIStore';
import { useData } from '@/lib/state';
import { supabase } from '@/lib/supabase';
import {
  addChecklist, addTimeEntry, archiveTasks, deleteChecklist, deleteTasks, duplicateTask, insertRow,
  setTaskLabels, updateChecklist, updateTask, applyTemplate,
} from '@/lib/actions';
import { describeRule } from '@/lib/quickadd';
import { formatMinutes, timeAgo } from '@/lib/dates';
import { cn, formatBytes } from '@/lib/utils';
import { STATUS_LABEL, PRIORITY_LABEL } from '@/lib/strings';
import { PALETTE } from '@/lib/colors';
import { Dialog, DialogDrawerContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { DatePill, IconTile, LabelChip, ProgressBar } from '@/components/ui/misc';
import { CompleteButton, DatePicker, PriorityCell, StatusCell, TimerButton } from './cells';
import { DependencyEditor } from './DependencyEditor';
import { uploadDocument, signedUrl } from '@/lib/storage';
import { toast } from 'sonner';

export function TaskDrawer() {
  const openId = useUI((s) => s.openTaskId);
  const openTask = useUI((s) => s.openTask);
  const { byId } = useData();
  const task = openId ? byId.get(openId) : undefined;
  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && openTask(null)}>
      <DialogDrawerContent>
        {task && <DrawerBody key={task.id} task={task} />}
      </DialogDrawerContent>
    </Dialog>
  );
}

function Prop({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[36px] grid-cols-[120px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <div className="flex items-center gap-2 text-sm text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const RECUR_PRESETS: [string, string][] = [['', 'ללא'], ['FREQ=DAILY', 'יומי'], ['FREQ=WEEKLY', 'שבועי'], ['FREQ=MONTHLY', 'חודשי'], ['FREQ=YEARLY', 'שנתי']];
const REMIND: [number, string][] = [[0, 'בזמן היעד'], [5, '5 דק׳ לפני'], [15, '15 דק׳ לפני'], [30, 'חצי שעה לפני'], [60, 'שעה לפני'], [1440, 'יום לפני']];

function DrawerBody({ task }: { task: Task }) {
  const openTask = useUI((s) => s.openTask);
  const set = useUI((s) => s.set);
  const { byId, topics, groups, sprints, goals, labels, tasks, documents, templates, topicById } = useData();
  const parent = task.parent_id ? byId.get(task.parent_id) : undefined;
  const topic = task.topic_id ? topicById.get(task.topic_id) : undefined;
  const subtasks = useMemo(() => tasks.filter((t) => t.parent_id === task.id).sort((a, b) => a.position - b.position), [tasks, task.id]);
  const topicGroups = groups.filter((g) => g.topic_id === task.topic_id).sort((a, b) => a.position - b.position);
  const docs = documents.filter((d) => d.task_id === task.id);
  const [title, setTitle] = useState(task.title);
  useEffect(() => setTitle(task.title), [task.title]);
  const done = task.status === 'done';

  const saveTitle = () => {
    const v = title.trim();
    if (v && v !== task.title) updateTask(task.id, { title: v });
    else setTitle(task.title);
  };

  return (
    <>
      <DialogTitle className="sr-only">{task.title}</DialogTitle>
      {/* ראש */}
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        {parent ? (
          <button onClick={() => openTask(parent.id)} className="flex min-w-0 items-center gap-1 rounded-sm px-2 py-1 text-sm text-primary hover:bg-primary-soft">
            <ArrowRight className="h-4 w-4 shrink-0" /><span className="truncate">חזרה ל: {parent.title}</span>
          </button>
        ) : topic ? (
          <span className="flex min-w-0 items-center gap-2 px-2 text-sm text-muted"><IconTile icon={topic.icon} name={topic.name} color={topic.color} size="xs" /><span className="truncate">{topic.name}</span></span>
        ) : <span className="px-2 text-sm text-muted">תיבת נכנסים</span>}
        <div className="ms-auto flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" aria-label="מצב פוקוס" title="מצב פוקוס" onClick={() => { openTask(null); set({ focusTaskId: task.id }); }}><Crosshair className="h-4 w-4" /></Button>
          <DropdownMenu>
            <DropdownTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="עוד"><MoreHorizontal className="h-4 w-4" /></Button></DropdownTrigger>
            <DropdownContent>
              <DropdownItem icon={<Copy />} onSelect={() => duplicateTask(task.id)}>שכפול</DropdownItem>
              {templates.length > 0 && templates.map((t) => (
                <DropdownItem key={t.id} icon={<ListChecks />} onSelect={() => applyTemplate(t.id, task.id)}>תבנית: {t.name}</DropdownItem>
              ))}
              <DropdownItem icon={<Archive />} onSelect={() => archiveTasks([task.id])}>העברה לארכיון</DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Trash2 />} danger onSelect={() => deleteTasks([task.id])}>מחיקה</DropdownItem>
            </DropdownContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" aria-label="סגירה" onClick={() => openTask(null)}><X className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
        {/* כותרת */}
        <div className="flex items-start gap-3">
          <div className="pt-2"><CompleteButton task={task} size={22} /></div>
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
            className={cn('min-h-[40px] flex-1 resize-none rounded-sm bg-transparent px-1 py-1 text-lg font-bold leading-7 focus:bg-surface-2 focus:outline-none [field-sizing:content]', done && 'text-muted line-through')} />
        </div>

        {/* מאפיינים */}
        <div className="mt-4 space-y-0.5">
          <Prop icon={<CircleDot />} label="סטטוס"><div className="w-40"><StatusCell task={task} /></div></Prop>
          <Prop icon={<Flag />} label="עדיפות"><div className="w-40"><PriorityCell task={task} /></div></Prop>
          <Prop icon={<CalendarDays />} label="תאריך יעד">
            <DatePicker value={task.due_date} onChange={(d) => updateTask(task.id, { due_date: d })} withTime time={task.due_time} onTimeChange={(t) => updateTask(task.id, { due_time: t })}>
              <button className="flex h-8 items-center rounded-sm px-2 hover:bg-surface-2"><DatePill date={task.due_date} time={task.due_time} done={done} /></button>
            </DatePicker>
          </Prop>
          <Prop icon={<CalendarRange />} label="תאריך התחלה">
            <DatePicker value={task.start_date} onChange={(d) => updateTask(task.id, { start_date: d })}>
              <button className="flex h-8 items-center rounded-sm px-2 hover:bg-surface-2"><DatePill date={task.start_date} done /></button>
            </DatePicker>
          </Prop>
          {task.due_time && (
            <Prop icon={<Bell />} label="תזכורת">
              <Select value={task.remind_before_min} onChange={(e) => updateTask(task.id, { remind_before_min: Number(e.target.value) })} className="h-8 w-44">
                {REMIND.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Prop>
          )}
          <Prop icon={<FolderOpen />} label="נושא">
            <div className="flex gap-2">
              <Select value={task.topic_id ?? ''} onChange={(e) => updateTask(task.id, { topic_id: e.target.value || null, group_id: null })} className="h-8 min-w-0 flex-1">
                <option value="">ללא נושא</option>
                {topics.filter((t) => !t.is_archived).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              {task.topic_id && topicGroups.length > 0 && (
                <Select value={task.group_id ?? ''} onChange={(e) => updateTask(task.id, { group_id: e.target.value || null })} className="h-8 min-w-0 flex-1">
                  <option value="">ללא קבוצה</option>
                  {topicGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              )}
            </div>
          </Prop>
          <Prop icon={<Zap />} label="ספרינט">
            <Select value={task.sprint_id ?? ''} onChange={(e) => updateTask(task.id, { sprint_id: e.target.value || null })} className="h-8">
              <option value="">ללא</option>
              {sprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Prop>
          <Prop icon={<Target />} label="מטרה">
            <Select value={task.goal_id ?? ''} onChange={(e) => updateTask(task.id, { goal_id: e.target.value || null })} className="h-8">
              <option value="">ללא</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </Select>
          </Prop>
          <Prop icon={<Tag />} label="תוויות"><LabelPicker task={task} /></Prop>
          <Prop icon={<Clock />} label="הערכת זמן">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} step={15} defaultValue={task.estimate_minutes ?? ''} placeholder="דקות" className="h-8 w-24"
                onBlur={(e) => { const v = e.target.value === '' ? null : Math.max(0, Math.min(100000, Math.round(Number(e.target.value)))); if (v !== task.estimate_minutes) updateTask(task.id, { estimate_minutes: v }); }} />
              {task.estimate_minutes ? <span className="text-xs text-subtle">{formatMinutes(task.estimate_minutes)}</span> : null}
            </div>
          </Prop>
          <Prop icon={<Timer />} label="זמן שנרשם">
            <div className="flex items-center gap-2">
              <span className="text-sm tabular">{formatMinutes(task.tracked_minutes)}</span>
              <TimerButton task={task} compact />
              <Popover>
                <PopoverTrigger asChild><Button size="sm" variant="ghost">+ ידני</Button></PopoverTrigger>
                <PopoverContent className="w-52">
                  <form onSubmit={(e) => { e.preventDefault(); const v = Number(new FormData(e.currentTarget).get('m')); if (v > 0) { addTimeEntry(task.id, v); toast.success('נרשם'); } }} className="flex gap-2">
                    <Input name="m" type="number" min={1} placeholder="דקות" className="h-8" autoFocus />
                    <Button size="sm" type="submit" variant="primary">הוספה</Button>
                  </form>
                </PopoverContent>
              </Popover>
            </div>
          </Prop>
          <Prop icon={<Repeat />} label="חזרתיות">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={RECUR_PRESETS.some(([v]) => v === (task.recurrence_rule ?? '')) ? task.recurrence_rule ?? '' : 'custom'}
                onChange={(e) => e.target.value !== 'custom' && updateTask(task.id, { recurrence_rule: e.target.value || null })} className="h-8 w-32">
                {RECUR_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                <option value="custom">מותאם</option>
              </Select>
              <Input defaultValue={task.recurrence_rule ?? ''} key={task.recurrence_rule} placeholder="FREQ=WEEKLY;BYDAY=MO,TH" dir="ltr" className="h-8 min-w-0 flex-1 text-xs"
                onBlur={(e) => { const v = e.target.value.trim().toUpperCase() || null; if (v !== task.recurrence_rule) { if (v && !/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.test(v)) return toast.error('כלל לא תקין'); updateTask(task.id, { recurrence_rule: v }); } }} />
              {task.recurrence_rule && <span className="w-full text-xs text-muted">{describeRule(task.recurrence_rule)} · בהשלמה נוצר המופע הבא</span>}
            </div>
          </Prop>
          <Prop icon={<GitBranch />} label="תלויות"><DependencyEditor task={task} /></Prop>
        </div>

        <Description task={task} />
        <Checklist task={task} />

        {/* תתי-משימות */}
        <Block icon={<ListChecks />} title="תתי-משימות" count={subtasks.length ? `${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length}` : undefined}>
          {subtasks.map((s) => (
            <div key={s.id} className="group flex min-h-[36px] items-center gap-2 rounded-sm px-2 hover:bg-surface-2 cursor-pointer" onClick={() => openTask(s.id)}>
              <CompleteButton task={s} size={16} />
              <span className={cn('flex-1 truncate text-sm', s.status === 'done' && 'text-subtle line-through')}>{s.title}</span>
              <span className="text-xs text-subtle">{STATUS_LABEL[s.status]}</span>
              <DatePill date={s.due_date} done={s.status === 'done'} className="text-xs" />
            </div>
          ))}
          <AddLine placeholder="תת-משימה חדשה…" onAdd={(v) => import('@/lib/actions').then((m) => m.createTask({ title: v, parent_id: task.id, topic_id: task.topic_id, group_id: task.group_id, sprint_id: task.sprint_id }, { open: false }))} />
        </Block>

        {/* מסמכים */}
        <Block icon={<Paperclip />} title="מסמכים" count={docs.length || undefined} action={
          (
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs text-primary hover:bg-primary-soft">
              <Upload className="h-3.5 w-3.5" />העלאה
              <input type="file" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                for (const f of files) {
                  const id = toast.loading(`מעלה ${f.name}…`);
                  try { await uploadDocument(f, task.topic_id, task.id, (p) => toast.loading(`מעלה ${f.name} · ${p}%`, { id })); toast.success('הועלה', { id }); }
                  catch (err) { toast.error((err as Error).message, { id }); }
                }
              }} />
            </label>
          )
        }>
          {docs.map((d) => (
            <button key={d.id} onClick={async () => window.open(await signedUrl(d.storage_path), '_blank')}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-surface-2">
              <Paperclip className="h-4 w-4 text-subtle" /><span className="flex-1 truncate">{d.filename}</span><span className="text-xs text-subtle">{formatBytes(d.size)}</span>
            </button>
          ))}
        </Block>

        <Activity taskId={task.id} />
      </div>
      {done && <div className="h-1.5 bg-[var(--status-done)]" />}
    </>
  );
}

function Block({ icon, title, count, action, children }: { icon: ReactNode; title: string; count?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {count !== undefined && <span className="text-xs text-subtle tabular">{count}</span>}
        <div className="ms-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function AddLine({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="flex items-center gap-2 px-2">
      <Plus className="h-4 w-4 text-subtle" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && v.trim() && !e.nativeEvent.isComposing) { onAdd(v.trim()); setV(''); } }}
        className="h-8 flex-1 bg-transparent text-sm placeholder:text-subtle focus:outline-none" />
    </div>
  );
}

function Description({ task }: { task: Task }) {
  const [editing, setEditing] = useState(!task.description);
  const [val, setVal] = useState(task.description);
  useEffect(() => setVal(task.description), [task.description]);
  const save = () => { if (val !== task.description) updateTask(task.id, { description: val }); if (val) setEditing(false); };
  return (
    <Block icon={<Pencil />} title="תיאור" action={task.description ? (
      <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)} iconStart={editing ? <Eye className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}>{editing ? 'תצוגה' : 'עריכה'}</Button>
    ) : null}>
      {editing ? (
        <Textarea value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} placeholder="פרטים, קישורים, הערות… (Markdown נתמך)" className="min-h-[110px]" />
      ) : (
        <div className="prose-md cursor-text rounded-sm px-2 py-1 text-sm hover:bg-surface-2" onClick={() => setEditing(true)}>
          <ReactMarkdown>{task.description}</ReactMarkdown>
        </div>
      )}
    </Block>
  );
}

function Checklist({ task }: { task: Task }) {
  const pct = task.checklist_total ? (task.checklist_done / task.checklist_total) * 100 : 0;
  return (
    <Block icon={<ListChecks />} title="צ׳קליסט" count={task.checklist_total ? `${task.checklist_done}/${task.checklist_total}` : undefined}>
      {task.checklist_total > 0 && <ProgressBar value={pct} color="var(--status-done)" className="mb-2" />}
      {task.checklist.map((c) => (
        <div key={c.id} className="group flex min-h-[34px] items-center gap-2 rounded-sm px-2 hover:bg-surface-2">
          <Checkbox checked={c.is_done} onChange={(v) => updateChecklist(c.id, { is_done: v })} />
          <input defaultValue={c.text} className={cn('h-7 flex-1 bg-transparent text-sm focus:outline-none', c.is_done && 'text-subtle line-through')}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.text) updateChecklist(c.id, { text: v }); }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
          <button onClick={() => deleteChecklist(c.id)} className="text-subtle opacity-0 hover:text-danger group-hover:opacity-100" aria-label="מחיקה"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <AddLine placeholder="פריט חדש…" onAdd={(v) => addChecklist(task.id, v)} />
    </Block>
  );
}

function LabelPicker({ task }: { task: Task }) {
  const { labels } = useData();
  const [q, setQ] = useState('');
  const toggle = (id: string) => setTaskLabels(task.id, task.labels.includes(id) ? task.labels.filter((l) => l !== id) : [...task.labels, id]);
  const filtered = labels.filter((l) => l.name.includes(q.trim()));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex min-h-[32px] w-full flex-wrap items-center gap-1 rounded-sm px-2 py-1 text-start hover:bg-surface-2">
          {task.labels.length ? task.labels.map((id) => { const l = labels.find((x) => x.id === id); return l ? <LabelChip key={id} name={l.name} color={l.color} /> : null; })
            : <span className="text-sm text-subtle">הוספת תווית</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש או יצירה…" className="mb-1 h-8" autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) {
              const exist = labels.find((l) => l.name === q.trim());
              if (exist) toggle(exist.id);
              else {
                const id = insertRow('labels', { name: q.trim(), color: PALETTE[labels.length % PALETTE.length].value });
                setTaskLabels(task.id, [...task.labels, id]);
              }
              setQ('');
            }
          }} />
        <div className="max-h-56 overflow-y-auto">
          {filtered.map((l) => (
            <label key={l.id} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 hover:bg-surface-2">
              <Checkbox checked={task.labels.includes(l.id)} onChange={() => toggle(l.id)} />
              <LabelChip name={l.name} color={l.color} />
            </label>
          ))}
          {q.trim() && !labels.some((l) => l.name === q.trim()) && <div className="px-2 py-1 text-xs text-subtle">Enter ליצירת "{q.trim()}"</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ACTION_TEXT: Record<string, string> = { created: 'נוצרה', automation: 'אוטומציה הופעלה' };
const FIELD_TEXT: Record<string, string> = { status: 'סטטוס', priority: 'עדיפות', due_date: 'תאריך יעד', title: 'כותרת', topic_id: 'נושא', sprint_id: 'ספרינט', start_date: 'תאריך התחלה' };

function Activity({ taskId }: { taskId: string }) {
  const { data } = useQuery({
    queryKey: ['activity', taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from('activity_log').select('id,action,payload,created_at').eq('task_id', taskId).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data as { id: number; action: string; payload: Record<string, string>; created_at: string }[];
    },
  });
  const fmt = (field: string, v: string | null) => {
    if (!v) return '—';
    if (field === 'status') return STATUS_LABEL[v as keyof typeof STATUS_LABEL] ?? v;
    if (field === 'priority') return PRIORITY_LABEL[v as keyof typeof PRIORITY_LABEL] ?? v;
    if (field.endsWith('_id')) return '…';
    return v;
  };
  if (!data?.length) return null;
  return (
    <Block icon={<History />} title="היסטוריה">
      <ol className="relative ms-2 border-s border-border ps-4">
        {data.map((a) => (
          <li key={a.id} className="relative pb-3 text-sm">
            <span className="absolute -start-[21px] top-1.5 h-2 w-2 rounded-full bg-border-strong" />
            <span className="text-text">
              {a.action === 'changed' ? <>{FIELD_TEXT[a.payload.field] ?? a.payload.field}: <span className="text-muted">{fmt(a.payload.field, a.payload.from)}</span> ← <b className="font-medium">{fmt(a.payload.field, a.payload.to)}</b></>
                : a.action === 'automation' ? <>אוטומציה: {a.payload.name || a.payload.action}</> : ACTION_TEXT[a.action] ?? a.action}
            </span>
            <span className="ms-2 text-xs text-subtle">{timeAgo(a.created_at)}</span>
          </li>
        ))}
      </ol>
    </Block>
  );
}

