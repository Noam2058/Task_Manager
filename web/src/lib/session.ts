import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { flushOutbox, loadCachedRaw, scheduleRefresh, STATE_KEY } from './db';

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** טוען cache מקומי (לעבודה בלי רשת), מסנכרן outbox, ומאזין לשינויים חיים מהמכשירים האחרים */
export function useSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadCachedRaw().then((raw) => {
      if (!cancelled && raw && !queryClient.getQueryData(STATE_KEY)) queryClient.setQueryData(STATE_KEY, raw, { updatedAt: 0 });
    });
    void flushOutbox();
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => scheduleRefresh(500))
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') { void flushOutbox(); scheduleRefresh(100); }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}

export async function signOut() {
  await supabase.auth.signOut();
  localStorage.removeItem('tm-outbox');
}
