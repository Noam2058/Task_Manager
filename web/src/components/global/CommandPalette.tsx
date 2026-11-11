import { useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import * as D from '@radix-ui/react-dialog';
import { CalendarDays, Crosshair, FileText, Hash, Keyboard, Moon, Plus, Search, SunMedium, Zap, LayoutDashboard, Inbox, CalendarRange, Settings } from 'lucide-react';
import { useData } from '@/lib/state';
import { useUI } from '@/store/useUIStore';
import { createTask } from '@/lib/actions';
import { Chips, useQuickAddParser } from '@/components/tasks/QuickAdd';
import { StatusPill } from '@/components/ui/misc';
import { Kbd } from '@/components/ui/misc';

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const set = useUI((s) => s.set);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const { tasks, topics, sprints, documents } = useData();
  const parsed = useQuickAddParser(q);
  const close = () => { set({ paletteOpen: false }); setQ(''); };
  const go = (path: string) => { close(); navigate(path); };
  const query = q.trim();
  const matchTasks = query ? tasks.filter((t) => t.title.includes(query) || t.description.includes(query)).slice(0, 8) : tasks.filter((t) => t.status !== 'done').sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const item = 'flex h-10 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-sm aria-selected:bg-surface-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted';
  const group = '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle';
  return (
    <D.Root open={open} onOpenChange={(o) => !o && close()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-[#0B0D14]/50 backdrop-blur-[2px]" />
        <D.Content aria-describedby={undefined} className="fixed inset-x-3 top-[10vh] z-50 mx-auto max-w-[640px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-in fade-in-0 zoom-in-95">
          <D.Title className="sr-only">פלטת פקודות</D.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-subtle" />
              <Command.Input value={q} onValueChange={setQ} placeholder="חיפוש או יצירת משימה…" className="h-12 flex-1 bg-transparent text-md placeholder:text-subtle focus:outline-none" />
              <Kbd>Esc</Kbd>
            </div>
            {query && parsed.chips.length > 0 && <Chips chips={parsed.chips} className="px-4 pt-2" />}
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-subtle">לא נמצא</Command.Empty>
              {query && (
                <Command.Group heading="יצירה" className={group}>
                  <Command.Item value="create" className={item} onSelect={() => {
                    createTask({ title: parsed.title || query, due_date: parsed.due_date, due_time: parsed.due_time, priority: parsed.priority, topic_id: parsed.topic_id, label_ids: parsed.label_ids, sprint_id: parsed.sprint_id, recurrence_rule: parsed.recurrence_rule });
                    close();
                  }}>
                    <Plus />צור משימה: <b className="truncate font-medium">{parsed.title || query}</b>
                  </Command.Item>
                </Command.Group>
              )}
              {matchTasks.length > 0 && (
                <Command.Group heading={query ? 'משימות' : 'עודכנו לאחרונה'} className={group}>
                  {matchTasks.map((t) => (
                    <Command.Item key={t.id} value={`t-${t.id}`} className={item} onSelect={() => { close(); useUI.getState().openTask(t.id); }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: topics.find((x) => x.id === t.topic_id)?.color ?? 'var(--border-strong)' }} />
                      <span className="flex-1 truncate">{t.title}</span>
                      <StatusPill status={t.status} className="h-5 text-[10px]" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {query && (
                <>
                  {topics.filter((t) => t.name.includes(query)).slice(0, 5).map((t) => (
                    <Command.Item key={t.id} value={`p-${t.id}`} className={item} onSelect={() => go(`/topics/${t.id}`)}><Hash />{t.name}</Command.Item>
                  ))}
                  {sprints.filter((s) => s.name.includes(query)).slice(0, 3).map((s) => (
                    <Command.Item key={s.id} value={`s-${s.id}`} className={item} onSelect={() => go(`/sprints/${s.id}`)}><Zap />{s.name}</Command.Item>
                  ))}
                  {documents.filter((d) => d.filename.includes(query)).slice(0, 4).map((d) => (
                    <Command.Item key={d.id} value={`d-${d.id}`} className={item} onSelect={() => go(d.topic_id ? `/topics/${d.topic_id}?tab=docs` : '/search')}><FileText />{d.filename}</Command.Item>
                  ))}
                </>
              )}
              {!query && (
                <>
                  <Command.Group heading="פעולות" className={group}>
                    <Command.Item value="new" className={item} onSelect={() => { close(); useUI.getState().openQuickAdd(); }}><Plus />משימה חדשה<span className="ms-auto"><Kbd>N</Kbd></span></Command.Item>
                    <Command.Item value="focus" className={item} onSelect={() => { close(); set({ focusTaskId: null }); }}><Crosshair />מצב פוקוס<span className="ms-auto"><Kbd>F</Kbd></span></Command.Item>
                    <Command.Item value="theme" className={item} onSelect={() => { close(); useUI.getState().setDark(document.documentElement.classList.contains('dark') ? 'light' : 'dark'); }}><Moon />החלפת ערכת נושא</Command.Item>
                    <Command.Item value="keys" className={item} onSelect={() => { close(); set({ shortcutsOpen: true }); }}><Keyboard />קיצורי מקלדת<span className="ms-auto"><Kbd>?</Kbd></span></Command.Item>
                  </Command.Group>
                  <Command.Group heading="ניווט" className={group}>
                    {[['/today', 'היום', SunMedium, 'G T'], ['/week', 'השבוע', CalendarRange, 'G W'], ['/calendar', 'יומן', CalendarDays, 'G C'], ['/inbox', 'נכנסים', Inbox, 'G I'], ['/', 'לוח בקרה', LayoutDashboard, 'G D'], ['/sprints', 'ספרינטים', Zap, 'G S'], ['/settings', 'הגדרות', Settings, '']].map(([p, l, Icon, k]) => {
                      const I = Icon as typeof SunMedium;
                      return <Command.Item key={p as string} value={`nav-${p}`} className={item} onSelect={() => go(p as string)}><I />{l as string}{k && <span className="ms-auto text-xs text-subtle">{k as string}</span>}</Command.Item>;
                    })}
                  </Command.Group>
                </>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
