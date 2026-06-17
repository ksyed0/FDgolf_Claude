const NS = '/fdgolf/static-map'
const CACHE_NAME = 'fdgolf-static-maps'

export function cacheKeyFor(holeId: string): string {
  return `${NS}/${holeId}`
}

/**
 * D4: fetch the Mapbox Static Images PNG once, cache by holeId via the Cache API,
 * and return an object URL. Served from cache offline; never re-fetched on GPS move.
 */
export async function fetchAndCacheStaticMap(holeId: string, url: string): Promise<string> {
  const key = cacheKeyFor(holeId)
  const cache = await caches.open(CACHE_NAME)
  let res = await cache.match(key)
  if (!res) {
    res = await fetch(url)
    if (!res.ok) throw new Error(`static map fetch failed: ${res.status}`)
    await cache.put(key, res.clone())
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
