// @vitest-environment happy-dom
// The soft keyboard, for every sheet and drawer: where it is (--kb, --vvh on <html>) worked out
// from a mocked visualViewport. A drawer is positioned by these, never resized: it keeps its
// height, stands on the keyboard and is capped to what is left above it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { applySheetKeyboard, sheetKeyboardInsets, startSheetKeyboard } from './sheet-keyboard.js'
import { NATIVE_KEYBOARD_EVENT } from './native-keyboard.js'

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8')
const root = () => document.documentElement

// A window the way the math sees one: the layout viewport's height and a visual viewport that
// moves around inside it. iPhone 15 Pro, installed: 393 x 852 with the keyboard ~336 + 44 high.
function fakeWindow({ innerHeight = 852, vv = { height: 852, offsetTop: 0 }, native = 0 } = {}) {
  const listeners = new Map()
  const viewport = vv && {
    ...vv,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
  }
  document.documentElement.style.setProperty('--native-kb', `${native}px`)
  return { win: { innerHeight, visualViewport: viewport, document }, viewport, listeners }
}

beforeEach(() => {
  root().removeAttribute('style')
  root().removeAttribute('data-kb')
})
afterEach(() => { vi.restoreAllMocks() })

describe('sheetKeyboardInsets', () => {
  it('is nothing while the keyboard is down: no lift, the whole screen above it', () => {
    const { win } = fakeWindow()
    expect(sheetKeyboardInsets(win)).toEqual({ bottomInset: 0, visualHeight: 852 })
  })

  it('lifts a sheet by the height the keyboard covers, and caps it to what is left', () => {
    const { win } = fakeWindow({ vv: { height: 472, offsetTop: 0 } })
    expect(sheetKeyboardInsets(win)).toEqual({ bottomInset: 380, visualHeight: 472 })
  })

  it('follows iOS scrolling the layout viewport under the keyboard (offsetTop): the visible part runs from offsetTop', () => {
    // the page was pushed up 120 px to show the field: what is in view is 120 .. 592
    const { win } = fakeWindow({ vv: { height: 472, offsetTop: 120 } })
    expect(sheetKeyboardInsets(win)).toEqual({ bottomInset: 260, visualHeight: 472 })
  })

  it('never lifts by less than nothing: a visual viewport taller than the layout one (browser chrome folding away)', () => {
    const { win } = fakeWindow({ innerHeight: 800, vv: { height: 852, offsetTop: 0 } })
    expect(sheetKeyboardInsets(win).bottomInset).toBe(0)
  })

  it('follows rotation: a landscape phone has a keyboard over most of a short screen', () => {
    const { win } = fakeWindow({ innerHeight: 393, vv: { height: 161, offsetTop: 0 } })
    expect(sheetKeyboardInsets(win)).toEqual({ bottomInset: 232, visualHeight: 161 })
  })

  it('falls back to the layout viewport where there is no visual viewport', () => {
    const { win } = fakeWindow({ vv: null })
    expect(sheetKeyboardInsets(win)).toEqual({ bottomInset: 0, visualHeight: 852 })
  })

  it('takes the larger of the visual-viewport inset and the Android 15 keyboard the app passes', () => {
    // edge to edge: the viewports do not move, --native-kb does
    expect(sheetKeyboardInsets(fakeWindow({ native: 336 }).win)).toEqual({ bottomInset: 336, visualHeight: 516 })
    // both report it: the larger wins, not the sum
    expect(sheetKeyboardInsets(fakeWindow({ native: 300, vv: { height: 472, offsetTop: 0 } }).win)).toEqual({ bottomInset: 380, visualHeight: 472 })
  })
})

describe('applySheetKeyboard', () => {
  it('writes --kb and --vvh and marks <html> while the keyboard is up', () => {
    const { win } = fakeWindow({ vv: { height: 472, offsetTop: 0 } })
    applySheetKeyboard(win)
    expect(root().style.getPropertyValue('--kb')).toBe('380px')
    expect(root().style.getPropertyValue('--vvh')).toBe('472px')
    expect(root().hasAttribute('data-kb')).toBe(true)
  })

  it('takes them away again when the keyboard goes: the sheets fall back to the whole screen', () => {
    applySheetKeyboard(fakeWindow({ vv: { height: 472, offsetTop: 0 } }).win)
    applySheetKeyboard(fakeWindow().win)
    expect(root().style.getPropertyValue('--kb')).toBe('0px')
    expect(root().style.getPropertyValue('--vvh')).toBe('')
    expect(root().hasAttribute('data-kb')).toBe(false)
  })
})

describe('startSheetKeyboard', () => {
  it('follows the visual viewport as the keyboard opens, iOS scrolls the page and the keyboard closes', () => {
    const { win, viewport, listeners } = fakeWindow()
    win.addEventListener = vi.fn()
    win.removeEventListener = vi.fn()
    win.requestAnimationFrame = fn => fn()
    const stop = startSheetKeyboard(win)
    expect(root().style.getPropertyValue('--kb')).toBe('0px')

    viewport.height = 472
    listeners.get('resize')()
    expect(root().style.getPropertyValue('--kb')).toBe('380px')

    viewport.offsetTop = 120
    listeners.get('scroll')()
    expect(root().style.getPropertyValue('--kb')).toBe('260px')

    viewport.height = 852
    viewport.offsetTop = 0
    listeners.get('resize')()
    expect(root().style.getPropertyValue('--kb')).toBe('0px')
    expect(root().hasAttribute('data-kb')).toBe(false)

    stop()
    expect(listeners.size).toBe(0)
  })

  it('follows the Android 15 keyboard event, rotation and focus', () => {
    const { win } = fakeWindow()
    const added = {}
    win.addEventListener = (type, fn) => { added[type] = fn }
    win.removeEventListener = () => {}
    win.requestAnimationFrame = fn => fn()
    startSheetKeyboard(win)
    expect(Object.keys(added)).toEqual(expect.arrayContaining(['resize', 'orientationchange', NATIVE_KEYBOARD_EVENT]))

    root().style.setProperty('--native-kb', '336px')
    added[NATIVE_KEYBOARD_EVENT]()
    expect(root().style.getPropertyValue('--kb')).toBe('336px')
    expect(root().style.getPropertyValue('--vvh')).toBe('516px')
  })
})

describe('the stylesheets', () => {
  const ds = read('../ds/ds.css')
  const css = read('../index.css')

  it('stand a drawer on the keyboard and cap it, instead of resizing its box', () => {
    const section = ds.slice(ds.indexOf('/* Sheet panels and keyboard */'))
    expect(section).toMatch(/\.g-bs \{\s*bottom: var\(--kb, 0px\);\s*max-height: calc\(var\(--vvh, 100dvh\) - var\(--sat, 0px\) - 8px\);/)
    // a half or full drawer has a height of its own, not a top that the lifted bottom would shorten
    expect(section).toMatch(/\.g-bs-half \{ height: 60%; \}/)
    expect(section).toMatch(/\.g-bs-full \{ height: calc\(100% - max\(56px, calc\(var\(--sat, 0px\) \+ 8px\)\)\); \}/)
    expect(ds).not.toMatch(/\.g-bs-(half|full) \{ top:/)
  })

  it('cover everything behind the drawer with the scrim, and the strip under it with its own colour', () => {
    expect(ds).toMatch(/\.g-bs-scrim, #modal-root \.mback \{ inset: -50vh 0; \}/)
    expect(ds).toMatch(/box-shadow: var\(--shadow-sheet\), 0 120px 0 0 var\(--surface\);/)
  })

  it('drop the safe-area padding at the foot while the keyboard covers the home indicator', () => {
    expect(ds).toContain(':root[data-kb] .g-bs { padding-bottom: 20px; }')
    expect(css).toContain(':root[data-kb] .sheet{padding-bottom:20px}')
  })

  it('no longer carry the per-sheet variables', () => {
    expect(ds).not.toContain('--picker-')
    expect(css).not.toContain('--picker-')
  })

  it('leave the viewport meta as it is, so Android Chrome keeps resizing only the visual viewport', () => {
    expect(read('../../index.html')).not.toContain('interactive-widget')
  })
})
