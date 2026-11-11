import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react';
import { useUI } from '@/store/useUIStore';
import { useData } from '@/lib/state';
import { addTimeEntry, toggleComplete, updateChecklist } from '@/lib/actions';
import { formatClock, today } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/input';
import { DatePill, PriorityBadge, ProgressRing } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const WORK = 25 * 60;
const BREAK = 5 * 60;

export function FocusMode() {
  const focusId = useUI((s) => s.focusTaskId);
  const set = useUI((s) => s.set);
  const { byId, tasks } = useData();
  const task = focusId ? byId.get(focusId) : undefined;
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [left, setLeft] = useState(WORK);
  const [running, setRunning] = useState(false);
  const [rounds, setRounds] = useState(0);
  const workedSec = useRef(0);

  useEffect(() => { setPhase('work'); setLeft(WORK); setRunning(false); workedSec.current = 0; }, [focusId]);
  useEffect(() => {
    if (!running) return;
    const i = setInterval(() => {
      setLeft((l) => {
        if (phase === 'work') workedSec.current += 1;
        if (l > 1) return l - 1;
        // סוף סבב
        if (phase === 'work') {
          setRounds((r) => r + 1);
          flushWorked();
          notify('סבב הסתיים 🎉', 'זמן להפסקה של 5 דקות');
          setPhase('break');
          return BREAK;
        }
        notify('ההפסקה נגמרה', 'חוזרים לעבודה');
        setPhase('work');
        return WORK;
      });
    }, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase]);

  const flushWorked = () => {
    const min = Math.round(workedSec.current / 60);
    if (task && min >= 1) addTimeEntry(task.id, min);
    workedSec.current = 0;
  };
  const close = () => { flushWorked(); set({ focusTaskId: undefined }); };

  if (focusId === undefined) return null;
  const total = phase === 'work' ? WORK : BREAK;
  const candidates = tasks.filter((t) => t.status !== 'done' && (t.due_date ?? '9999') <= today()).slice(0, 12);
  const fallback = candidates.length ? candidates : tasks.filter((t) => t.status !== 'done').slice(0, 12);

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-bg animate-in fade-in-0 safe-top safe-bottom">
      <div className="flex items-center justify-between p-4">
        <span className="text-sm font-medium text-muted">מצב פוקוס{rounds ? ` · ${rounds} סבבים` : ''}</span>
        <Button variant="ghost" size="icon" onClick={close} aria-label="יציאה"><X className="h-5 w-5" /></Button>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center overflow-y-auto px-6 pb-10">
        <ProgressRing value={((total - left) / total) * 100} size={200} stroke={10} color={phase === 'work' ? 'var(--primary)' : 'var(--status-done)'}>
          <div className="text-center">
            <div className="text-2xl font-bold tabular">{formatClock(left)}</div>
            <div className="text-xs text-muted">{phase === 'work' ? 'עבודה' : 'הפסקה'}</div>
          </div>
        </ProgressRing>
        <div className="mt-5 flex gap-2">
          <Button variant="primary" size="lg" onClick={() => setRunning(!running)} iconStart={running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}>{running ? 'השהיה' : 'התחלה'}</Button>
          <Button variant="outline" size="lg" onClick={() => { setLeft(total); setRunning(false); }} aria-label="איפוס"><RotateCcw className="h-5 w-5" /></Button>
          <Button variant="outline" size="lg" aria-label="דילוג" onClick={() => { if (phase === 'work') flushWorked(); setPhase(phase === 'work' ? 'break' : 'work'); setLeft(phase === 'work' ? BREAK : WORK); }}><SkipForward className="h-5 w-5" /></Button>
        </div>

        {task ? (
          <div className="mt-10 w-full">
            <div className="flex items-center gap-3 text-sm"><PriorityBadge priority={task.priority} /><DatePill date={task.due_date} /></div>
            <h2 className={cn('mt-2 text-2xl font-bold', task.status === 'done' && 'text-muted line-through')}>{task.title}</h2>
            {task.description && <div className="prose-md mt-4 text-muted"><ReactMarkdown>{task.description}</ReactMarkdown></div>}
            {task.checklist.length > 0 && (
              <div className="mt-6 space-y-1">
                {task.checklist.map((c) => (
                  <label key={c.id} className="flex min-h-[40px] cursor-pointer items-center gap-3 rounded px-3 text-md hover:bg-surface-2">
                    <Checkbox checked={c.is_done} onChange={(v) => updateChecklist(c.id, { is_done: v })} className="h-5 w-5" />
                    <span className={cn(c.is_done && 'text-subtle line-through')}>{c.text}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-8 flex gap-2">
              <Button variant={task.status === 'done' ? 'outline' : 'primary'} onClick={() => void toggleComplete(task.id)}>{task.status === 'done' ? 'פתיחה מחדש' : 'סימון כהושלם'}</Button>
              <Button variant="ghost" onClick={() => set({ focusTaskId: null })}>משימה אחרת</Button>
            </div>
          </div>
        ) : (
          <div className="mt-10 w-full">
            <div className="mb-2 text-sm font-medium text-muted">על מה מתמקדים?</div>
            <div className="space-y-1">
              {fallback.map((t) => (
                <button key={t.id} onClick={() => set({ focusTaskId: t.id })} className="card flex w-full items-center gap-3 p-3 text-start hover:shadow-md">
                  <span className="flex-1 truncate font-medium">{t.title}</span><DatePill date={t.due_date} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: '/icon-192.png' });
    navigator.vibrate?.([200, 100, 200]);
  } catch { /* ignore */ }
}
