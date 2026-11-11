import { useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock, Flag, Hash, Plus, Repeat, Tag, Zap } from 'lucide-react';
import { useData } from '@/lib/state';
import { parseQuickAdd, type Chip } from '@/lib/quickadd';
import { createTask } from '@/lib/actions';
import { addDays, formatRelative, today } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/useUIStore';
import { Dialog, DialogBody, DialogModalContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/misc';
import { S } from '@/lib/strings';

export interface QuickAddDefaults {
  topic_id?: string; group_id?: string; sprint_id?: string; due_date?: string; start_date?: string; parent_id?: string; goal_id?: string;
}

const CHIP_ICON: Record<Chip['kind'], typeof Hash> = {
  date: CalendarDays, time: Clock, priority: Flag, topic: Hash, label: Tag, sprint: Zap, recur: Repeat,
};

export function useQuickAddParser(text: string) {
  const { topics, labels, sprints } = useData();
  return useMemo(
    () => parseQuickAdd(text, { today: today(), topics: topics.filter((t) => !t.is_archived), labels, sprints }),
    [text, topics, labels, sprints],
  );
}

export function Chips({ chips, className }: { chips: Chip[]; className?: string }) {
  if (!chips.length) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {chips.map((c, i) => {
        const Icon = CHIP_ICON[c.kind];
        return (
          <span key={i} className="inline-flex h-6 animate-rise items-center gap-1 rounded-full bg-primary-soft px-2 text-xs font-medium text-primary">
            <Icon className="h-3 w-3" />{c.text}
          </span>
        );
      })}
    </div>
  );
}

function submit(text: string, parsed: ReturnType<typeof parseQuickAdd>, defaults: QuickAddDefaults, open?: boolean) {
  const title = parsed.title || text.trim();
  if (!title) return false;
  createTask({
    title,
    topic_id: parsed.topic_id ?? defaults.topic_id,
    group_id: parsed.topic_id && parsed.topic_id !== defaults.topic_id ? undefined : defaults.group_id,
    sprint_id: parsed.sprint_id ?? defaults.sprint_id,
    parent_id: defaults.parent_id,
    goal_id: defaults.goal_id,
    due_date: parsed.due_date ?? (defaults.due_date || undefined),
    due_time: parsed.due_time,
    start_date: defaults.start_date,
    priority: parsed.priority,
    recurrence_rule: parsed.recurrence_rule,
    label_ids: parsed.label_ids,
  }, { open });
  return true;
}

/** שורת "+ הוסף משימה" בטבלה */
export function InlineQuickAdd({ defaults, placeholder = S.addTask, autoFocus }: { defaults: QuickAddDefaults; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(!!autoFocus);
  const parsed = useQuickAddParser(text);
  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center gap-2">
        <Plus className="h-4 w-4 shrink-0 text-subtle" />
        <input value={text} onChange={(e) => setText(e.target.value)} autoFocus={autoFocus}
          onFocus={() => setFocused(true)} onBlur={() => !text && setFocused(false)}
          placeholder={placeholder} aria-label={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              if (submit(text, parsed, defaults, false)) setText('');
            }
            if (e.key === 'Escape') { setText(''); (e.target as HTMLInputElement).blur(); }
          }}
          className="h-8 min-w-0 flex-1 bg-transparent text-base placeholder:text-subtle focus:outline-none" />
        {focused && text && <span className="hidden text-xs text-subtle sm:inline">Enter ליצירה</span>}
      </div>
      {focused && <Chips chips={parsed.chips} className="ps-6 pb-1" />}
    </div>
  );
}

/** דיאלוג גלובלי (N / כפתור + במובייל) */
export function QuickAddDialog() {
  const open = useUI((s) => s.quickAddOpen);
  const defaults = useUI((s) => s.quickAddDefaults);
  const set = useUI((s) => s.set);
  const [text, setText] = useState('');
  const [extraDate, setExtraDate] = useState<string | undefined>(undefined);
  const parsed = useQuickAddParser(text);
  const { topics, topicById } = useData();
  const [topicId, setTopicId] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => { set({ quickAddOpen: false }); setText(''); setExtraDate(undefined); setTopicId(undefined); };
  const effDefaults = { ...defaults, due_date: extraDate ?? defaults.due_date, topic_id: topicId ?? defaults.topic_id };
  const go = (openAfter: boolean) => { if (submit(text, parsed, effDefaults, openAfter)) close(); };
  const t = today();
  const liveTopics = topics.filter((x) => !x.is_archived).slice(0, 8);
  const selectedTopic = parsed.topic_id ?? effDefaults.topic_id;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogModalContent size="md" onOpenAutoFocus={(e) => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 30); }}>
        <DialogTitle className="sr-only">{S.newTask}</DialogTitle>
        <DialogBody className="pt-4">
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="מה צריך לעשות?"
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) go(e.metaKey || e.ctrlKey); }}
            className="h-11 w-full bg-transparent text-lg font-medium placeholder:text-subtle focus:outline-none" />
          <Chips chips={parsed.chips} className="mb-3 min-h-[24px]" />

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[['היום', t], ['מחר', addDays(t, 1)], ['ללא תאריך', '']].map(([l, d]) => {
              const active = (extraDate ?? defaults.due_date ?? '') === d && !parsed.due_date;
              return (
                <button key={l} onClick={() => setExtraDate(d)} className={cn('inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-sm', active ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted')}>
                  <CalendarDays className="h-3.5 w-3.5" />{l}
                </button>
              );
            })}
            <label className="relative inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border px-3 text-sm text-muted">
              <CalendarDays className="h-3.5 w-3.5" />
              {extraDate && ![t, addDays(t, 1), ''].includes(extraDate) ? formatRelative(extraDate) : 'תאריך…'}
              <input type="date" className="absolute inset-0 opacity-0" onChange={(e) => setExtraDate(e.target.value || '')} />
            </label>
          </div>

          {!defaults.parent_id && liveTopics.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {liveTopics.map((tp) => (
                <button key={tp.id} onClick={() => setTopicId(tp.id === topicId ? undefined : tp.id)}
                  className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm', selectedTopic === tp.id ? 'border-transparent text-white' : 'border-border text-muted')}
                  style={selectedTopic === tp.id ? { background: tp.color } : undefined}>
                  {selectedTopic !== tp.id && <span className="h-2 w-2 rounded-full" style={{ background: tp.color }} />}{tp.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 hidden text-xs text-subtle sm:block">תחביר: {S.quickAddHint} · <Kbd>Enter</Kbd> יצירה · <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> יצירה ופתיחה</div>
          {defaults.parent_id && <div className="mt-2 text-xs text-muted">תת-משימה</div>}
          {selectedTopic && !liveTopics.some((x) => x.id === selectedTopic) && <div className="mt-2 text-xs text-muted">נושא: {topicById.get(selectedTopic)?.name}</div>}
        </DialogBody>
        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <Button variant="primary" onClick={() => go(false)} disabled={!text.trim()}>יצירה</Button>
          <Button variant="ghost" onClick={() => go(true)} disabled={!text.trim()}>יצירה ופתיחה</Button>
        </div>
      </DialogModalContent>
    </Dialog>
  );
}
