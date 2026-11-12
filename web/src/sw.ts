/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// SPA: כל ניווט → index.html (עובד גם בלי רשת)
const SCOPE = self.registration.scope; // למשל https://noam2058.github.io/Task_Manager/
registerRoute(new NavigationRoute(createHandlerBoundToURL(new URL('index.html', SCOPE).pathname)));
registerRoute(({ request }) => request.destination === 'font', new CacheFirst({ cacheName: 'fonts' }));

// ---------- Push ----------
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'ניהול משימות', body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title ?? 'ניהול משימות', {
    body: data.body ?? '',
    icon: new URL('icon-192.png', SCOPE).href,
    badge: new URL('icon-192.png', SCOPE).href,
    tag: data.tag,
    dir: 'rtl',
    lang: 'he',
    data: { url: data.url ?? '/today' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // נתיב פנימי (/today?task=…) — יחסית ל-scope של האפליקציה
  const route = '/' + String(event.notification.data?.url ?? '/today').replace(/^\//, '');
  const full = new URL(route.slice(1), SCOPE).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'open-url', url: route });
      return;
    }
    await self.clients.openWindow(full);
  })());
});
