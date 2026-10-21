// @vitest-environment happy-dom
// SavedIndicator: idle shows nothing but keeps its live region; the other states say where the
// last change is, on a light header or as the stage's glass pill (board T1.14).
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import SavedIndicator from './SavedIndicator.jsx'
import { click, useView } from './render.test-util.js'
import { PRESETS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

const view = useView()
const pill = () => view.host.querySelector('.g-saved')

describe('SavedIndicator', () => {
  it('idle renders nothing visible and keeps a polite live region', () => {
    view.render(<SavedIndicator />)
    expect(pill()).toBeNull()
    expect(view.host.firstElementChild.getAttribute('aria-live')).toBe('polite')
    view.render(<SavedIndicator tone="stage" />)
    expect(pill()).toBeNull()
    expect(view.host.firstElementChild.getAttribute('aria-live')).toBe('polite')
  })

  it.each([
    ['saved', 'Saved'],
    ['syncing', 'Syncing'],
    ['error', 'Not saved · Retry'],
  ])('%s says %s', (state, text) => {
    view.render(<SavedIndicator state={state} />)
    expect(pill().textContent).toBe(text)
    expect(pill().classList.contains('g-saved-' + state)).toBe(true)
  })

  it('offline counts the changes waiting, in the singular too, and says Offline with none', () => {
    view.render(<SavedIndicator state="offline" waiting={3} tone="stage" />)
    expect(pill().textContent).toBe('Offline · 3 changes waiting')
    view.render(<SavedIndicator state="offline" waiting={1} tone="stage" />)
    expect(pill().textContent).toBe('Offline · 1 change waiting')
    view.render(<SavedIndicator state="offline" />)
    expect(pill().textContent).toBe('Offline')
  })

  it('light draws a dot, stage a glass pill with an icon (a dot while syncing)', () => {
    view.render(<SavedIndicator state="saved" />)
    expect(pill().querySelector('i')).not.toBeNull()
    expect(pill().classList.contains('g-glass')).toBe(false)
    view.render(<SavedIndicator state="saved" tone="stage" />)
    expect(pill().classList.contains('g-glass')).toBe(true)
    expect(pill().querySelector('svg')).not.toBeNull()
    expect(pill().querySelector('i')).toBeNull()
    view.render(<SavedIndicator state="syncing" tone="stage" />)
    expect(pill().querySelector('i')).not.toBeNull()
  })

  it('is a button that opens the waiting list when it has onClick, and only said without', () => {
    const onClick = vi.fn()
    view.render(<SavedIndicator state="offline" waiting={2} onClick={onClick} />)
    expect(pill().tagName).toBe('BUTTON')
    click(pill())
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<SavedIndicator state="offline" waiting={2} />)
    expect(pill().tagName).toBe('SPAN')
    expect(view.host.querySelector('button')).toBeNull()
  })

  it('the stage pill, once Saved has had its say, stays while its row closes, then goes', async () => {
    const driver = fakeMotionDriver()
    setMotionDriver(driver)
    try {
      view.render(<SavedIndicator state="saved" tone="stage" />)
      const el = pill()
      view.render(<SavedIndicator tone="stage" />)
      expect(pill()).toBe(el)
      expect(el.textContent).toBe('Saved')
      expect(driver.on(el).map(a => a.keyframes)).toEqual([PRESETS.foldAway.exit.keyframes])
      expect(driver.on(el.parentElement).at(-1).keyframes.at(-1)).toEqual({ height: '0px' })
      await act(async () => { for (const a of driver.running()) a.finish() })
      expect(pill()).toBeNull()
      expect(view.host.firstElementChild.getAttribute('aria-live')).toBe('polite')
    } finally {
      setMotionDriver(null)
    }
  })

  it('refuses a state or tone the design system does not have, in development', () => {
    expect(() => view.render(<SavedIndicator state="lost" />)).toThrow(/state="lost"/)
    expect(() => view.render(<SavedIndicator tone="dark" />)).toThrow(/tone="dark"/)
  })
})
