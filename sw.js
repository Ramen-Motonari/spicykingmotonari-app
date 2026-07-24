/* Service Worker — メニュー画像の永続キャッシュ
   Firebase Storage / Firestore CDN の画像を1度ダウンロードしたら
   ローカルキャッシュから即座に返す。これにより2回目以降は一瞬で表示。
   - キャッシュ期間: ブラウザ再起動・キャッシュクリアまで
   - 戦略: stale-while-revalidate（キャッシュ即返し＋裏で最新取得）
*/
const CACHE_NAME = 'motonari-img-v1';
const HTML_CACHE = 'motonari-html-v1';
const IMG_HOST_PATTERNS = [
  /firebasestorage\.googleapis\.com/,
  /storage\.googleapis\.com/,
  /\.appspot\.com/
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // 古いキャッシュバージョンを削除（現行の画像・HTMLキャッシュ以外）
  const keep = [CACHE_NAME, HTML_CACHE];
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // ── HTMLドキュメント（ページ本体）はネットワーク優先で常に最新を取得 ──
  //   これによりデプロイ後すぐに最新版がお客様の端末に反映される。
  //   オフライン時のみ、直近にキャッシュしたHTMLへフォールバック。
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        const cache = await caches.open(HTML_CACHE);
        const hit = await cache.match(req);
        return hit || Response.error();
      }
    })());
    return;
  }

  const isImage = IMG_HOST_PATTERNS.some(re => re.test(url.hostname));
  if (!isImage) return;

  // 画像は stale-while-revalidate（キャッシュ即返し＋裏で最新取得）
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(req);
    const fetchPromise = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => hit);
    return hit || fetchPromise;
  })());
});
