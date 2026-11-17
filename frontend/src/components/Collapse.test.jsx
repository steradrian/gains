// @vitest-environment happy-dom
/* A card put away in place (Today's welcome back, the saved pill) used to vanish on the tap, and
 * everything under it jumped up. Collapse keeps it mounted while its content fades and its row
 * closes from its own height to 0, then lets it go; under reduced motion it goes at once. */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Collapse from './Collapse.jsx'
import { Presence } from './presence.jsx'
import { MS, PRESETS, collapse, setMotionDriver } from '../lib/motion.js'
import { fakeMotionDriver } from '../lib/motion.test-util.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, driver
const show = on => act(async () => {
  root.render(<div><Presence>{on && <Collapse key="card"><p className="card">Welcome back</p></Collapse>}</Presence><p className="below">Rings</p></div>)
})
const row = () => host.querySelector('.collapse')

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  driver = fakeMotionDriver()
  setMotionDriver(driver)
  root = createRoot(host)
})
afterEach(async () => {
  setMotionDriver(null)
  await act(async () => { root.unmount() })
  host.remove()
  delete document.documentElement.dataset.motion
})

describe('Collapse', () => {
  it('comes in at once, as the card always did', async () => {
    await show(true)
    expect(host.querySelector('.card')).not.toBeNull()
    expect(driver.calls).toHaveLength(0)
  })

  it('stays mounted while its content fades and its row closes, then unmounts', async () => {
    await show(true)
    const el = row()
    const card = host.querySelector('.card')
    Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 180 })

    await show(false)
    expect(row()).toBe(el)
    expect(el.hasAttribute('inert')).toBe(true)
    expect(el.hasAttribute('data-leaving')).toBe(true)
    const [fade] = driver.on(card)
    expect(fade.keyframes).toEqual(PRESETS.foldAway.exit.keyframes)
    expect(fade.options).toMatchObject({ duration: MS.exit, fill: 'forwards' })
    const [close] = driver.on(el)
    expect(close.keyframes).toEqual([{ height: '180px' }, { height: '0px' }])
    expect(close.keyframes).toEqual(collapse(180).exit.keyframes)
    expect(close.options).toMatchObject({ duration: MS.slow, fill: 'forwards' })
    // what is under it is still where it was: it moves up with the row, not ahead of it
    expect(host.querySelector('.below').previousElementSibling).toBe(el)

    await act(async () => { fade.finish(); close.finish() })
    expect(row()).toBeNull()
    expect(host.querySelector('.below')).not.toBeNull()
  })

  it('goes at once under reduced motion, with nothing played', async () => {
    document.documentElement.dataset.motion = 'reduce'
    await show(true)
    await show(false)
    expect(row()).toBeNull()
    expect(driver.calls).toHaveLength(0)
  })
})
