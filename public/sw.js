// laozig 探针 · 离线 Service Worker(手写,无需构建插件)
// 策略:导航请求 network-first(离线回退 index.html);同源静态资源
// stale-while-revalidate;跨域(字体/旗帜/汇率/WebSocket)一律直连不拦截。
const CACHE = 'laozig-v1'
const SHELL = ['./', './index.html', './logo.png', './manifest.webmanifest']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return // 跨域资源直连

  // 导航:优先网络,离线回退缓存的 index.html
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')))
    return
  }

  // 同源静态资源:stale-while-revalidate
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then(c => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || net
    }),
  )
})
