import { supabase } from './supabase';

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID && !VAPID.includes('<');

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('הדפדפן לא תומך בהתראות Push (באייפון: צריך להוסיף למסך הבית קודם)');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('ההרשאה להתראות נדחתה');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID!) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const { error } = await supabase.functions.invoke('push-reminders', { body: { test: true } });
  if (error) throw error;
}
