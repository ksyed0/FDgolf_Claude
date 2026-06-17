import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAndCacheStaticMap, cacheKeyFor } from '@/lib/round/static-map'

const PNG = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })

function installCacheMock() {
  const store = new Map<string, Response>()
  const cache = {
    match: vi.fn(async (k: string) => store.get(k)),
    put: vi.fn(async (k: string, r: Response) => {
      store.set(k, r)
    }),
  }
  // @ts-expect-error test shim
  globalThis.caches = { open: vi.fn(async () => cache) }
  return cache
}

beforeEach(() => {
  vi.restoreAllMocks()
  // @ts-expect-error test shim
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
})

describe('cacheKeyFor', () => {
  it('keys by hole id under a stable namespace', () => {
    expect(cacheKeyFor('hole-7')).toBe('/fdgolf/static-map/hole-7')
  })
})

describe('fetchAndCacheStaticMap', () => {
  it('fetches once and caches the PNG when not cached', async () => {
    const cache = installCacheMock()
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }))
    // @ts-expect-error test shim
    globalThis.fetch = fetchMock
    const url = await fetchAndCacheStaticMap('hole-7', 'https://api.mapbox.com/x')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(cache.put).toHaveBeenCalledTimes(1)
    expect(url).toBe('blob:mock')
  })

  it('serves the cached PNG without re-fetching (preserves quota offline)', async () => {
    const cache = installCacheMock()
    await cache.put('/fdgolf/static-map/hole-7', new Response(PNG, { status: 200 }))
    const fetchMock = vi.fn()
    // @ts-expect-error test shim
    globalThis.fetch = fetchMock
    const url = await fetchAndCacheStaticMap('hole-7', 'https://api.mapbox.com/x')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(url).toBe('blob:mock')
  })
})
