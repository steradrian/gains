// @vitest-environment happy-dom
// Log activity (board Ea7Activity) and the Burned-only drawer (Ea7Burned, "Tap it to add one"):
// Burned starts as weight x minutes x the type and follows both until typed over, the copy under it
// uses the real weight and minutes and is gone without a weight, and Save writes through the
// activity writer, closes, and leaves the person on Burned with the row in the store.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { type, useView } from '../../ds/render.test-util.js'
import { createFakeNutriTrace } from '../../lib/nutrition/fake-nutritrace.js'
import { useActivityWrites } from '../../lib/nutrition/activity.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import ActivitySheet from './ActivitySheet.jsx'
import BurnedAmountSheet from './BurnedAmountSheet.jsx'

const view = useView()
const DATE = '2026-10-17'
let nt

const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise(r => setTimeout(r, 10)) }) }
const field = label => [...view.host.querySelectorAll('label.g-tfield')].find(l => l.querySelector('.g-tfield-label').textContent === label)?.querySelector('input')
const button = label => [...view.host.querySelectorAll('button')].find(b => b.textContent === label)
const hint = () => view.host.querySelector('.g-act-hint')?.textContent ?? null
const minutesWheel = () => view.host.querySelector('[role="spinbutton"][aria-label="Minutes"]')
const arrow = (el, key) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) })

const weigh = (bodyweight = [{ d: DATE, w: 81.4 }], unit = 'kg') => useStore.setState({ S: { ...useStore.getState().S, unit, bodyweight } })

beforeEach(async () => {
  nt = createFakeNutriTrace({
    activity: { [DATE]: [{ id: 7, date: DATE, name: 'Legs', kcal: 0, duration_min: 61, distance: null, source: 'opengym', covered_by: null }] },
  })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useActivityWrites.setState({ supported: true })
  await useNutrition.getState().loadSettings()
})
afterEach(() => vi.unstubAllGlobals())

describe('Log activity', () => {
  const open = async (props = {}) => {
    const close = vi.fn()
    view.render(<ActivitySheet date={DATE} type="run" minutes={31} close={close} {...props} />)
    await settle()
    return close
  }

  it('offers the six types with the run chosen, and the wheel on the minutes asked for', async () => {
    weigh()
    await open()
    const chips = [...view.host.querySelectorAll('.g-cchip')]
    expect(chips.map(c => c.textContent)).toEqual(['Run', 'Ride', 'Swim', 'Football', 'Class', 'Other'])
    expect(chips[0].getAttribute('aria-pressed')).toBe('true')
    expect(minutesWheel().getAttribute('aria-valuenow')).toBe('31')
  })

  it('prefills Burned from the real weight and minutes, and says so', async () => {
    weigh()
    await open()
    expect(field('Burned').value).toBe('410')
    expect(hint()).toBe('Worked out from 81.4 kg and 31 min of running. Change it if your watch says otherwise.')
  })

  it('follows the type and the wheel until Burned is typed over', async () => {
    weigh()
    await open()
    await act(async () => { button('Ride').click() })
    expect(field('Burned').value).toBe('315')
    expect(hint()).toContain('of cycling')
    arrow(minutesWheel(), 'ArrowUp')
    await settle()
    expect(field('Burned').value).toBe('325')
    expect(hint()).toContain('32 min')
    type(field('Burned'), '300')
    expect(field('Burned').value).toBe('300')
    expect(hint()).toBeNull()
  })

  it('leaves Burned empty and the line out without a weigh-in, and cannot save until a number is typed', async () => {
    weigh([])
    await open()
    expect(field('Burned').value).toBe('')
    expect(hint()).toBeNull()
    expect(button('Save activity').disabled).toBe(true)
    type(field('Burned'), '300')
    expect(button('Save activity').disabled).toBe(false)
  })

  it('uses the pound the person weighs in, not a converted number', async () => {
    weigh([{ d: DATE, w: 180 }], 'lb')
    await open()
    expect(hint()).toContain('Worked out from 180 lb and 31 min')
  })

  it('writes the activity, reads the day back and closes', async () => {
    weigh()
    const close = await open()
    type(field('Distance'), '5.2')
    await act(async () => { button('Save activity').click() })
    await settle()
    expect(nt.writes()).toHaveLength(1)
    expect(nt.writes()[0]).toMatchObject({
      method: 'POST', path: '/nt/api/activity', body: { date: DATE, name: 'Run', kcal: 410, duration_min: 31, distance: 5.2 },
    })
    expect(useNutrition.getState().activity[DATE].rows.map(r => r.name)).toContain('Run')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps the drawer open with what was typed when the save fails', async () => {
    weigh()
    const close = await open()
    nt.failNext('POST', '/nt/api/activity', { status: 500 })
    await act(async () => { button('Save activity').click() })
    await settle()
    expect(view.host.textContent).toContain('Not saved. Try again.')
    expect(field('Burned').value).toBe('410')
    expect(close).not.toHaveBeenCalled()
  })

  it('says logging arrives soon, not an error, when the hub takes no activity writes yet', async () => {
    weigh()
    const close = await open()
    nt.failNext('POST', '/nt/api/activity', { status: 404 })
    await act(async () => { button('Save activity').click() })
    await settle()
    expect(view.host.textContent).toContain('Logging activity arrives soon')
    expect(view.host.textContent).not.toContain('Not saved')
    expect(useActivityWrites.getState().supported).toBe(false)
    expect(close).not.toHaveBeenCalled()
  })

  it('refuses a distance that is not a number', async () => {
    weigh()
    await open()
    type(field('Distance'), 'far')
    expect(button('Save activity').disabled).toBe(true)
  })
})

describe('adding a Burned number', () => {
  const row = { id: 7, date: DATE, name: 'Legs', workout: true, minutes: 61, distance: null, kcal: 0, coveredBy: null }

  it('shows the workout and takes only the number', async () => {
    view.render(<BurnedAmountSheet row={row} today="2026-10-18" close={vi.fn()} />)
    await settle()
    expect(view.host.querySelector('h2').textContent).toBe('Legs')
    expect(view.host.querySelectorAll('input')).toHaveLength(1)
    expect(button('Save Burned').disabled).toBe(true)
  })

  it('writes the number on that row, leaves its name and minutes, and closes', async () => {
    const close = vi.fn()
    await useNutrition.getState().loadActivity(DATE)
    view.render(<BurnedAmountSheet row={row} today="2026-10-18" close={close} />)
    await settle()
    type(field('Burned'), '300')
    await act(async () => { button('Save Burned').click() })
    await settle()
    expect(nt.writes()[0]).toMatchObject({ method: 'PUT', path: '/nt/api/activity/7', body: { kcal: 300 } })
    expect(useNutrition.getState().activity[DATE].rows[0]).toMatchObject({ name: 'Legs', kcal: 300, duration_min: 61 })
    expect(close).toHaveBeenCalledTimes(1)
  })
})
