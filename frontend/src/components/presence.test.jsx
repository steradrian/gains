// @vitest-environment happy-dom
/* The kit's presence (components/presence.jsx): a child taken out stays in the page, out of reach,
 * until its way out is over; one that comes back plays the way out back; reduced motion fades;
 * and where nothing can animate (happy-dom on its own) it goes at once, as every test of a closing
 * sheet expects. The Web Animations API is the fake driver from lib/motion.test-util.js. */
import React, { act, useRef, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Presence, leavingProps, useEnterExit, usePresence, useSheetClosed } from './presence.jsx'
import { MS, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const RISE = {
  enter: { keyframes: [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], ms: 220, easing: 'ease' },
  exit: { keyframes: [{ opacity: 0, transform: 'translateY(4px)' }], ms: 160, easing: 'ease-in' },
  rm: {
    enter: { keyframes: [{ opacity: 0 }, { opacity: 1 }], ms: MS.rm, easing: 'linear' },
    exit: { keyframes: [{ opacity: 0 }], ms: MS.rm, easing: 'linear' },
  },
}

// A tiny outside store, so a leaving child can be made to render again against changed state.
let gone = false
const subs = new Set()
const setGone = v => { gone = v; subs.forEach(f => f()) }
const useGone = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f) }, () => gone)

function Note({ label }) {
  const ref = useRef(null)
  const { present } = usePresence()
  const fail = useGone()
  if (fail && !present) throw new Error('rendered against deleted state')
  useEnterExit(() => [[ref.current, RISE]])
  return <div ref={ref} className="note" {...leavingProps(present)}><button>{label}</button></div>
}

let root, host, driver
const render = (show, extra = {}) => act(async () => {
  root.render(<Presence {...extra}>{show ? <Note key="n" label={show} /> : null}</Presence>)
})
const note = () => host.querySelector('.note')

beforeEach(() => {
  document.body.innerHTML = '<div id="root"></div>'
  host = document.getElementById('root')
  root = createRoot(host)
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  gone = false
})
afterEach(async () => {
  await act(async () => { root.unmount() })
  setMotionDriver(null)
  delete document.documentElement.dataset.motion
  vi.restoreAllMocks()
})

describe('Presence', () => {
  it('plays the way in on mount', async () => {
    await render('Saved')
    const [enter] = driver.on(note())
    expect(enter.keyframes).toEqual(RISE.enter.keyframes)
    expect(enter.options).toMatchObject({ duration: 220, easing: 'ease', fill: 'none' })
  })

  it('keeps a removed child, out of reach from its first leaving render, until its way out is over', async () => {
    await render('Saved')
    const el = note()
    await render(null)
    expect(note()).toBe(el)
    expect(el.hasAttribute('inert')).toBe(true)
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.hasAttribute('data-leaving')).toBe(true)
    // the way in was stopped where it was, and the way out started from there and holds its end
    expect(driver.calls[0].playState).toBe('idle')
    const exit = driver.calls.at(-1)
    expect(exit.keyframes).toEqual(RISE.exit.keyframes)
    expect(exit.options).toMatchObject({ duration: 160, fill: 'forwards' })

    await act(async () => { exit.finish() })
    expect(note()).toBeNull()
  })

  it('tells the parent once every child has gone', async () => {
    const done = vi.fn()
    await render('Saved', { onExitComplete: done })
    await render(null, { onExitComplete: done })
    expect(done).not.toHaveBeenCalled()
    await act(async () => { driver.calls.at(-1).finish() })
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('lets a child go after the safety timer when its animation never reports back', async () => {
    vi.useFakeTimers()
    try {
      await render('Saved')
      await render(null)
      expect(note()).not.toBeNull()
      await act(async () => { vi.advanceTimersByTime(160 + 100) })
      expect(note()).toBeNull()
    } finally { vi.useRealTimers() }
  })

  it('comes back in full when the child returns while leaving, and keeps it', async () => {
    await render('Saved')
    const el = note()
    // taken out before its way in was over: that frame is kept as its own style for the way out
    await render(null)
    const exit = driver.calls.at(-1)
    expect(el.style.opacity).toBe('0')
    await render('Saved again')
    expect(note()).toBe(el)
    expect(el.hasAttribute('data-leaving')).toBe(false)
    expect(el.hasAttribute('inert')).toBe(false)
    expect(el.textContent).toBe('Saved again')
    // the way out is dropped, the kept frame is gone and the way in plays from the start: not a
    // reversed exit, which would come to rest on the half-faded frame
    expect(exit.playState).toBe('idle')
    expect(el.style.opacity).toBe('')
    expect(el.style.transform).toBe('')
    const again = driver.calls.at(-1)
    expect(again).not.toBe(exit)
    expect(again.keyframes).toEqual(RISE.enter.keyframes)
    // and nothing still pending takes it away
    await act(async () => { driver.running().forEach(a => a.finish()) })
    await act(async () => { await new Promise(r => setTimeout(r, 160 + 120)) })
    expect(note()).toBe(el)
  })

  it('keeps the content it was showing through the way out', async () => {
    await render('Saved')
    await render(null)
    expect(note().textContent).toBe('Saved')
  })

  it('drops a leaving child that fails to render, without taking anything else down', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await render('Saved')
    await render(null)
    await act(async () => { setGone(true) })
    expect(note()).toBeNull()
  })

  it('removes a child at once where nothing can animate', async () => {
    setMotionDriver(null)
    expect(typeof HTMLElement.prototype.animate).toBe('undefined')
    await render('Saved')
    await render(null)
    expect(note()).toBeNull()
  })
})

describe('useSheetClosed', () => {
  function Closing({ onClosed }) {
    const ref = useRef(null)
    useSheetClosed(onClosed)
    useEnterExit(() => [[ref.current, RISE]])
    return <div ref={ref} className="note" />
  }
  const renderClosing = (show, onClosed) => act(async () => {
    root.render(<Presence>{show ? <Closing key="c" onClosed={onClosed} /> : null}</Presence>)
  })

  it('runs the latest callback once, as the child stops being present, and not again when it unmounts', async () => {
    const first = vi.fn()
    const latest = vi.fn()
    await renderClosing(true, first)
    await renderClosing(true, latest)
    expect(latest).not.toHaveBeenCalled()
    await renderClosing(false, latest)
    // before the way out is over: the child is still in the page
    expect(note()).not.toBeNull()
    expect(latest).toHaveBeenCalledTimes(1)
    await act(async () => { driver.calls.at(-1).finish() })
    expect(note()).toBeNull()
    expect(latest).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('runs at unmount where there is no Presence around it', async () => {
    const onClosed = vi.fn()
    await act(async () => { root.render(<Closing onClosed={onClosed} />) })
    expect(onClosed).not.toHaveBeenCalled()
    await act(async () => { root.render(null) })
    expect(onClosed).toHaveBeenCalledTimes(1)
  })
})

describe('Presence under reduced motion', () => {
  it('fades only, over --rm, both ways', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await render('Saved')
    await render(null)
    const [enter, exit] = driver.calls
    for (const anim of [enter, exit]) {
      expect(anim.keyframes.every(k => Object.keys(k).every(p => p === 'opacity'))).toBe(true)
      expect(anim.options).toMatchObject({ duration: MS.rm, easing: 'linear' })
    }
  })

  it('finishes what is running the moment the app is told to keep still', async () => {
    await render('Saved')
    await render(null)
    expect(note()).not.toBeNull()
    await act(async () => {
      document.documentElement.dataset.motion = 'reduce'
      await new Promise(r => setTimeout(r, 0))
    })
    expect(note()).toBeNull()
  })
})
