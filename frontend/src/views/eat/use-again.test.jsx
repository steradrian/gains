// @vitest-environment happy-dom
// "Yesterday's lunch [Log again]" on the Eat root (E1.0, edge E1.0): shown only while yesterday had
// the meal and every entry can be logged again, one write for the whole meal, the same copy sent
// again adds nothing, and Undo removes exactly what the write added. Moved from FoodHub.test.jsx.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { isoOf, todayISO } from '../../lib/format.js'
import { createFakeNutriTrace, fixtureDay, fixtureSettings } from '../../lib/nutrition/fake-nutritrace.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { click, useView } from '../../ds/render.test-util.js'
import { useAgain } from './use-again.js'

const view = useView()
const TODAY = todayISO()
const YESTERDAY = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return isoOf(d) })()
const DINNER = 2
let nt

// A dinner yesterday that can be logged again (a food, rebuilt from its server id).
const yesterdayDinner = () => ({ ...fixtureDay(YESTERDAY).items[0], uuid: 'y-dinner', meal: DINNER, name: 'Lentil soup', addedAt: `${YESTERDAY}T19:00:00.000Z` })

function Probe() {
  const again = useAgain({ settings: fixtureSettings(), meal: DINNER })
  if (!again) return <i data-none />
  return <button type="button" disabled={again.busy || !again.ready} onClick={again.log}>{again.done ? 'Logged' : 'Log again'}</button>
}
const button = () => view.host.querySelector('button')

const settle = async check => {
  const end = Date.now() + 3000
  for (;;) {
    try { check(); return } catch (e) {
      if (Date.now() > end) throw e
      await act(async () => { await new Promise(r => setTimeout(r, 25)) })
    }
  }
}

beforeEach(() => {
  nt = createFakeNutriTrace({ days: { [TODAY]: fixtureDay(TODAY), [YESTERDAY]: fixtureDay(YESTERDAY) } })
  vi.stubGlobal('fetch', nt.fetch)
  useStore.setState({ user: { id: 3, name: 'Ana' }, pushState: vi.fn(async () => {}) })
  useNutrition.getState().reset()
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('when it is offered', () => {
  it('is gone when yesterday had nothing for the meal', async () => {
    view.render(<Probe />)
    await settle(() => expect(view.host.querySelector('[data-none]')).not.toBeNull())
  })

  it('is gone when any entry cannot be logged again (a saved meal row has no food of its own)', async () => {
    nt.state.days[YESTERDAY].items.push(yesterdayDinner(), { ...yesterdayDinner(), uuid: 'y-meal', food_server_id: null, is_recipe: true })
    view.render(<Probe />)
    await settle(() => expect(view.host.querySelector('[data-none]')).not.toBeNull())
  })
})

describe('logging it again', () => {
  beforeEach(() => { nt.state.days[YESTERDAY].items.push(yesterdayDinner()) })

  it('logs the meal to Today, the row reads Logged, and Undo removes exactly that entry', async () => {
    view.render(<Probe />)
    await settle(() => expect(button()?.disabled).toBe(false))
    const before = nt.state.days[TODAY].items.map(i => i.uuid)
    click(button())
    await settle(() => expect(useUI.getState().toastMsg).toBe('Logged yesterday’s Dinner to Today, Dinner'))
    const fresh = nt.state.days[TODAY].items.find(i => i.name === 'Lentil soup')
    expect(fresh).toMatchObject({ meal: DINNER, food_server_id: 11, portion: 60, unit: 'g', quantity: 1 })
    await settle(() => expect(button().textContent).toBe('Logged'))

    await act(async () => { useUI.getState().runToastAction() })
    await settle(() => expect(nt.state.days[TODAY].items.map(i => i.uuid)).toEqual(before))
    await settle(() => expect(button().textContent).toBe('Log again'))
  })

  it('does not log twice when the answer is lost and it is tapped again', async () => {
    view.render(<Probe />)
    await settle(() => expect(button()?.disabled).toBe(false))
    nt.failNext('PUT', `/nt/api/diary/${TODAY}`, { lost: true })
    click(button())
    await settle(() => expect(useUI.getState().toastMsg).toContain('Not saved: no connection.'))
    await settle(() => expect(button()?.disabled).toBe(false))
    click(button())
    await settle(() => expect(useUI.getState().toastMsg).toBe('Logged yesterday’s Dinner to Today, Dinner'))
    expect(nt.state.days[TODAY].items.filter(i => i.name === 'Lentil soup')).toHaveLength(1)
  })

  it('logs every entry of the meal in one write', async () => {
    nt.state.days[YESTERDAY].items.push({ uuid: 'y-tea', meal: DINNER, addedAt: `${YESTERDAY}T19:05:00.000Z`, type: 'quick_calories', name: 'Tea', nutrition: { calories: 40 }, food_server_id: null })
    view.render(<Probe />)
    await settle(() => expect(button()?.disabled).toBe(false))
    const before = nt.state.days[TODAY].items.length
    click(button())
    await settle(() => expect(useUI.getState().toastMsg).toContain('Logged yesterday’s'))
    expect(nt.writes().filter(w => w.path === `/nt/api/diary/${TODAY}`)).toHaveLength(1)
    expect(nt.state.days[TODAY].items.length).toBe(before + 2)
  })
})
