import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { onOutboxChange, outboxSize } from '@/lib/db';
import { Tooltip } from '@/components/ui/menu';
import { cn } from '@/lib/utils';

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function usePending() {
  const [n, setN] = useState(outboxSize());
  useEffect(() => { const off = onOutboxChange(() => setN(outboxSize())); return () => { off(); }; }, []);
  return n;
}

export function SyncIndicator({ className }: { className?: string }) {
  const online = useOnline();
  const pending = usePending();
  const label = !online ? `לא מקוון${pending ? ` · ${pending} שינויים ממתינים` : ''}` : pending ? `מסנכרן ${pending}…` : 'מסונכרן';
  return (
    <Tooltip content={label}>
      <span className={cn('flex h-7 w-7 items-center justify-center rounded-sm', !online ? 'text-warning' : pending ? 'text-primary' : 'text-subtle', className)} aria-label={label}>
        {!online ? <CloudOff className="h-4 w-4" /> : pending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
      </span>
    </Tooltip>
  );
}
