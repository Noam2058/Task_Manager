import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUI } from '@/store/useUIStore';
import { isTypingTarget } from '@/lib/utils';
import { today } from '@/lib/dates';
import { Dialog, DialogBody, DialogHeader, DialogModalContent } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/misc';

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const gPressed = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.set({ paletteOpen: !ui.paletteOpen }); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (ui.openTaskId || ui.paletteOpen || ui.quickAddOpen || ui.focusTaskId !== undefined || ui.shortcutsOpen || document.querySelector('[role="dialog"],[role="menu"]')) return;
      const k = e.key.toLowerCase();
      if (Date.now() - gPressed.current < 1200) {
        gPressed.current = 0;
        const map: Record<string, string> = { t: '/today', w: '/week', m: '/month', c: '/calendar', i: '/inbox', d: '/', s: '/sprints' };
        if (map[k]) { e.preventDefault(); navigate(map[k]); }
        return;
      }
      if (k === 'g') { gPressed.current = Date.now(); return; }
      if (k === 'n') {
        e.preventDefault();
        const p = location.pathname;
        const topic = p.match(/^\/topics\/([^/]+)/)?.[1];
        const sprint = p.match(/^\/sprints\/([^/]+)/)?.[1];
        ui.openQuickAdd({ topic_id: topic, sprint_id: sprint, due_date: p === '/today' ? today() : undefined });
      } else if (k === 'f') { e.preventDefault(); ui.set({ focusTaskId: (document.activeElement as HTMLElement)?.dataset?.taskId ?? null }); }
      else if (e.key === '?') { e.preventDefault(); ui.set({ shortcutsOpen: true }); }
      else if (k === 'j' || e.key === 'ArrowDown') {
        const first = document.querySelector<HTMLElement>('[data-task-row]');
        if (first && !document.activeElement?.hasAttribute('data-task-row')) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, location.pathname]);
}

const KEYS: [string[], string][] = [
  [['N'], 'משימה חדשה (לפי ההקשר)'], [['Ctrl', 'K'], 'פלטת פקודות'], [['G', 'T/W/M/C/I/D/S'], 'היום / שבוע / חודש / יומן / נכנסים / לוח בקרה / ספרינטים'],
  [['↑', '↓'], 'ניווט בין שורות (או J/K)'], [['Enter'], 'פתיחת המשימה (או E)'], [['Space'], 'השלמה'], [['X'], 'בחירה'], [['F'], 'מצב פוקוס'], [['?'], 'חלון עזרה'],
];

export function ShortcutsDialog() {
  const open = useUI((s) => s.shortcutsOpen);
  const set = useUI((s) => s.set);
  return (
    <Dialog open={open} onOpenChange={(o) => set({ shortcutsOpen: o })}>
      <DialogModalContent size="md">
        <DialogHeader title="קיצורי מקלדת" />
        <DialogBody>
          <div className="divide-y divide-border">
            {KEYS.map(([k, l]) => (
              <div key={l} className="flex items-center justify-between py-2.5 text-sm">
                <span>{l}</span>
                <span className="flex gap-1">{k.map((x) => <Kbd key={x}>{x}</Kbd>)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-subtle">במובייל: החלקה שמאלה על משימה = השלמה, ימינה = דחייה למחר.</p>
        </DialogBody>
      </DialogModalContent>
    </Dialog>
  );
}

