import '@testing-library/jest-dom'

// Node.js 25+ exposes a built-in `localStorage` global that lacks the Web Storage API methods
// (clear, length, key, etc.) when running without a persistence file. This polyfill replaces it
// with a minimal in-memory Storage implementation so tests can call localStorage.clear() etc.
const _store: Record<string, string> = {}
const _webStorage: Storage = {
  get length() {
    return Object.keys(_store).length
  },
  key(index: number) {
    return Object.keys(_store)[index] ?? null
  },
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(_store, key) ? _store[key] : null
  },
  setItem(key: string, value: string) {
    _store[key] = String(value)
  },
  removeItem(key: string) {
    delete _store[key]
  },
  clear() {
    Object.keys(_store).forEach((k) => delete _store[k])
  },
}

// Only replace if the built-in lacks `clear` (Node 25+ without a file path)
if (typeof localStorage === 'undefined' || typeof localStorage.clear !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).localStorage = _webStorage
}
