import { useEffect } from 'react';
import { useData } from '@/lib/state';
import { today } from '@/lib/dates';

/** כשהאפליקציה פתוחה — התראות מקומיות. כשהיא סגורה — ה-Push מהשרת מטפל בזה. */
export function useReminders() {
  const { tasks } = useData();
  useEffect(() => {
    const check = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      let sent: Record<string, 1> = {};
      try { sent = JSON.parse(sessionStorage.getItem('tm-notified') || '{}'); } catch { /* */ }
      const t = today();
      const now = new Date();
      for (const x of tasks) {
        if (x.status === 'done' || x.due_date !== t || !x.due_time) continue;
        const [h, m] = x.due_time.split(':').map(Number);
        const at = new Date(); at.setHours(h, m - (x.remind_before_min ?? 0), 0, 0);
        const key = `${x.id}|${t}|${x.due_time}`;
        if (now >= at && now.getTime() - at.getTime() < 30 * 60000 && !sent[key] && x.reminded_key !== `${t} ${x.due_time}`) {
          sent[key] = 1;
          navigator.serviceWorker?.ready.then((r) => r.showNotification(x.title, { body: `תזכורת · ${x.due_time}`, icon: `${import.meta.env.BASE_URL}icon-192.png`, tag: key, data: { url: `/today?task=${x.id}` } }))
            .catch(() => new Notification(x.title, { body: `תזכורת · ${x.due_time}` }));
        }
      }
      sessionStorage.setItem('tm-notified', JSON.stringify(sent));
    };
    check();
    const i = setInterval(check, 30000);
    return () => clearInterval(i);
  }, [tasks]);
}
