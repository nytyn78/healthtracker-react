const CACHE = "healthtracker-v1.0.0"
const BASE  = "/healthtracker-react"
const ASSETS = [
  BASE + "/",
  BASE + "/index.html",
  BASE + "/manifest.json",
  BASE + "/foods.json",
  BASE + "/icon-192.png",
  BASE + "/icon-512.png",
]

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE)
      await cache.addAll(ASSETS)
    } catch {}
    self.skipWaiting()
  })())
})

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map(key => key !== CACHE ? caches.delete(key) : undefined))
      const clients = await self.clients.matchAll()
      clients.forEach(c => c.postMessage({ type: "SW_UPDATED" }))
    } catch {}
    await self.clients.claim()
  })())
})

async function networkFirst(request, cacheName, timeout = 0) {
  const cache = await caches.open(cacheName)
  try {
    let response
    if (timeout > 0) {
      response = await Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout))
      ])
    } else {
      response = await fetch(request)
    }
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error("network and cache both failed")
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch { return cached }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)
  event.respondWith((async () => {
    try {
      if (url.pathname === BASE + "/" || url.pathname === BASE + "/index.html")
        return await networkFirst(event.request, CACHE)
      if (url.pathname === BASE + "/foods.json")
        return await networkFirst(event.request, CACHE, 3000)
      return await cacheFirst(event.request, CACHE)
    } catch {
      try {
        const fallback = await caches.match(event.request)
        if (fallback) return fallback
      } catch {}
      return new Response("Offline", { status: 503 })
    }
  })())
})

self.addEventListener("message", event => {
  if (!event.data?.type) return
  if (event.data.type === "GET_VERSION")
    event.source.postMessage({ type: "SW_VERSION", version: CACHE })
  if (event.data.type === "SKIP_WAITING") self.skipWaiting()
})
