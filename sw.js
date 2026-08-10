// ════════════════════════════════════════════════════════
// Service Worker — FFM PLN UP3 Jayapura (Petugas Lapangan)
// Tujuan: aplikasi tetap BISA DIBUKA walau HP sedang tanpa sinyal
// (mode pesawat / blank spot). Data GPS & laporan tetap diantrekan
// secara terpisah lewat localStorage di petugas.html (lihat
// OFFLINE_QUEUE_KEY) — service worker ini HANYA bertugas meng-cache
// file aplikasi (HTML/JS/CSS) supaya layar tidak blank saat offline.
// ════════════════════════════════════════════════════════

const CACHE_NAME = 'ffm-petugas-shell-v2';

// File aplikasi itu sendiri + library eksternal (Firebase SDK) yang
// dipakai saat runtime. Kalau nanti versi Firebase di petugas.html
// diganti, baris di bawah ini WAJIB ikut disesuaikan.
const SHELL_FILES = [
  './petugas.html',
  './master-data.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        SHELL_FILES.map((url) =>
          cache.add(url).catch((err) => {
            // Kalau salah satu gagal di-cache (mis. saat install offline),
            // jangan sampai bikin seluruh instalasi SW gagal.
            console.warn('[SW] Gagal cache:', url, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategi: Network First untuk halaman utama (supaya update terbaru
// langsung kepakai saat online), fallback ke cache kalau offline.
// Stale-While-Revalidate untuk file pendukung (Firebase SDK dll).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isAppShell = req.mode === 'navigate'
    || url.pathname.endsWith('petugas.html')
    || url.pathname.endsWith('master-data.js'); // ikut network-first, jangan stale-while-revalidate

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || (req.mode === 'navigate' ? caches.match('./petugas.html') : undefined)))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
