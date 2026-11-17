/* Thư Hiên – service worker: giúp cài ứng dụng về máy và mở nhanh.
   Trang luôn lấy bản mới nhất từ máy chủ trước (để cập nhật tức thì); chỉ dùng bản lưu khi mất mạng. */
const VERSION = 'thuhien-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => Promise.all(SHELL.map((u) => cache.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, Google, R2... do trình duyệt tự xử lý

  const isDoc = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isDoc) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((hit) => hit || new Response('<meta charset="utf-8"><title>Thư Hiên</title><p style="font-family:sans-serif;padding:2rem">Bạn đang ngoại tuyến. Hãy kết nối mạng rồi thử lại.</p>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    );
    return;
  }

  if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname) || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});

/* ===== Thông báo đẩy: hiện thông báo khi có người tương tác, kể cả lúc đã đóng ứng dụng ===== */
self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) {
    try { p = { data: { title: 'Thư Hiên', body: event.data.text() } }; } catch (e2) { p = {}; }
  }
  const d = (p && p.data) ? p.data : (p || {});
  const n = (p && p.notification) ? p.notification : {};
  const title = d.title || n.title || 'Thư Hiên';
  const options = {
    body: d.body || n.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  let target = '/';
  try { const u = new URL(raw, self.location.origin); if (u.origin === self.location.origin) target = u.pathname + u.search + u.hash; } catch (e) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          return c.focus().then((w) => (w && 'navigate' in w ? w.navigate(target).catch(() => null) : null));
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
