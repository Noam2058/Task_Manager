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
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));
registerRoute(({ request }) => request.destination === 'font', new CacheFirst({ cacheName: 'fonts' }));

// ---------- Push ----------
self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'ניהול משימות', body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(data.title ?? 'ניהול משימות', {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    dir: 'rtl',
    lang: 'he',
    data: { url: data.url ?? '/today' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? '/today';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all.find((c) => new URL(c.url).origin === self.location.origin);
    if (client) {
      await client.focus();
      client.postMessage({ type: 'open-url', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
