import '@testing-library/jest-dom'
import { JSDOM } from 'jsdom'

// Node.js 25+ exposes a built-in `localStorage` that lacks the Web Storage API methods.
// Create a proper jsdom-backed localStorage and restore it as the global so bare
// `localStorage.clear()` calls work correctly in tests.
const _dom = new JSDOM('', { url: 'http://localhost' })
const _jsdomStorage = _dom.window.localStorage

// @ts-expect-error — intentional test-only override
global.localStorage = _jsdomStorage
// @ts-expect-error — intentional test-only override
global.sessionStorage = _dom.window.sessionStorage
