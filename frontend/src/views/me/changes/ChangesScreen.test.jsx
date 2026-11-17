// @vitest-environment happy-dom
// Recent changes (M4.0 to M4.2): the route over an in-memory journal. Rows grouped by day, the
// Restore flow and its toasts, the Coach's Undo, refusals, the double tap, the live list, the empty scene.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useView } from '../../../ds/render.test-util.js'
import { memoryJournal } from '../../../dev/screens/states/me-changes-fixture.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import ChangesRoute from './ChangesRoute.jsx'

const view = useView()
const DAY = 86400000
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const stamp = daysAgo => { const d = new Date(Date.now() - daysAgo * DAY); d.setHours(9, 12, 0, 0); return d }
const entry = (id, kind, daysAgo, rest = {}) => ({
  id, kind, at: stamp(daysAgo).getTime(), day: iso(stamp(daysAgo)), subject: '', facts: {}, action: 'restore', state: 'open', ...rest,
})
const OATS = entry('f1', 'food-delete', 0, { subject: 'Oats with milk', facts: { meal: 'Breakfast', day: iso(stamp(1)), kcal: 380, time: '09:12' } })
const ROUTINE = entry('r1', 'routine-delete', 1, { subject: 'Legs deload', facts: { exercises: 5 } })
const COACH = entry('c1', 'coach-move', 2, { subject: 'Legs', action: 'undo', facts: { change: 'moved', weekday: 1, from: 5, to: 1 } })

let savedS, savedUpdate
beforeEach(() => {
  savedS = useStore.getState().S
  savedUpdate = useStore.getState().update
  useStore.setState({ S: { ...savedS, unit: 'kg' } })
  useUI.setState({ toastMsg: '', toastAction: null })
})
afterEach(() => {
  useStore.setState({ S: savedS, update: savedUpdate })
  useUI.setState({ toastMsg: '', toastAction: null })
})

const show = (entries, results) => {
  const journal = memoryJournal(entries, results)
  vi.spyOn(journal, 'restore')
  vi.spyOn(journal, 'undo')
  view.render(<ChangesRoute journal={journal} />)
  return journal
}
const text = () => view.host.textContent
const button = label => [...view.host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent).trim() === label)
const tap = async el => { await act(async () => { el.click() }) }
const toast = () => useUI.getState().toastMsg

describe('Recent changes', () => {
  it('M4.0: the title and line, a header per day newest first, a row with its words and a Restore each', () => {
    show([ROUTINE, OATS, COACH])
    expect([...view.host.querySelectorAll('h1')].map(h => h.textContent)).toEqual(['Recent changes'])
    expect(text()).toContain('Deletes and changes from the last 7 days')
    expect([...view.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent).slice(0, 2)).toEqual(['Today', 'Yesterday'])
    expect(text()).toContain('Deleted Oats with milk')
    expect(text()).toContain('380 kcal')
    expect(text()).toContain('Deleted routine Legs deload')
    expect(text()).toContain('5 exercises')
    expect(text()).toContain('Coach moved Legs')
    expect(button('Restore: Deleted Oats with milk')).toBeTruthy()
    expect(button('Undo: Coach moved Legs')).toBeTruthy()
    expect(text()).toContain('Restoring puts it back where it was: the same day, the same meal, the same workout.')
  })

  it('M4.1: Restore swaps the button for a Restored tag and the toast names the day and meal, with Undo', async () => {
    const journal = show([OATS, ROUTINE])
    await tap(button('Restore: Deleted Oats with milk'))
    expect(journal.restore).toHaveBeenCalledWith('f1')
    expect(button('Restore: Deleted Oats with milk')).toBeUndefined()
    expect(view.host.querySelector('.g-tag').textContent).toBe('Restored')
    expect(toast()).toMatch(/^Restored Oats with milk to .+/)
    expect(useUI.getState().toastAction.label).toBe('Undo')
  })

  it('the toast Undo puts the row back as it was', async () => {
    const journal = show([OATS])
    await tap(button('Restore: Deleted Oats with milk'))
    await act(async () => { useUI.getState().runToastAction() })
    expect(journal.undo).toHaveBeenCalledWith('f1')
    expect(button('Restore: Deleted Oats with milk')).toBeTruthy()
    expect(view.host.querySelector('.g-tag')).toBeNull()
  })

  it('says so when the food went to Snacks because its meal was deleted', async () => {
    show([OATS], { f1: { ok: true, where: { day: OATS.facts.day, meal: 'snacks' }, fellBack: 'snacks' } })
    await tap(button('Restore: Deleted Oats with milk'))
    expect(toast()).toMatch(/, Snacks\. Breakfast was deleted\.$/)
  })

  it('a refusal gives the reason in a toast and leaves the row with its button', async () => {
    show([entry('w1', 'weighin-edit', 0, { facts: { from: 81.8, to: 81.7, unit: 'kg' } })], { w1: { ok: false, reason: 'replaced' } })
    await tap(button('Restore: Changed a weigh-in'))
    expect(toast()).toBe('Couldn’t restore: that day already has a weigh-in')
    expect(button('Restore: Changed a weigh-in')).toBeTruthy()
    expect(view.host.querySelector('.g-tag')).toBeNull()
  })

  it('an offline food restore says to try again and keeps the row', async () => {
    show([OATS], { f1: { ok: false, reason: 'error' } })
    await tap(button('Restore: Deleted Oats with milk'))
    expect(toast()).toBe('Couldn’t restore. Check your connection and try again.')
    expect(button('Restore: Deleted Oats with milk')).toBeTruthy()
  })

  it('a restore that answers replaced reads Already back, not an error', async () => {
    show([ROUTINE], { r1: { ok: false, reason: 'replaced' } })
    await tap(button('Restore: Deleted routine Legs deload'))
    expect(toast()).toBe('Already back')
    expect(view.host.querySelector('.g-tag').textContent).toBe('Already back')
  })

  it('a second tap while the first is running is ignored', async () => {
    let finish
    const journal = show([OATS])
    journal.restore.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const el = button('Restore: Deleted Oats with milk')
    await tap(el)
    expect(button('Restore: Deleted Oats with milk').getAttribute('aria-busy')).toBe('true')
    await tap(button('Restore: Deleted Oats with milk'))
    expect(journal.restore).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true, where: { day: OATS.facts.day, meal: 'Breakfast' } }) })
  })

  it('the Coach row is an Undo with no Undo on its toast, and the chat gets its reverted note', async () => {
    const draft = { coach: { chat: [] } }
    useStore.setState({ update: mut => mut(draft) })
    show([COACH])
    await tap(button('Undo: Coach moved Legs'))
    expect(toast()).toBe('Plan restored')
    expect(useUI.getState().toastAction).toBeNull()
    expect(draft.coach.chat.at(-1).kind).toBe('reverted')
  })

  it('relists when the journal changes while the page is open', async () => {
    const journal = show([OATS])
    expect(text()).not.toContain('Deleted routine Legs deload')
    const next = memoryJournal([OATS, ROUTINE])
    journal.list = next.list
    await act(async () => { await journal.restore('missing') })
    // restore of an unknown id answers ok in the fixture and notifies its listeners
    expect(text()).toContain('Deleted routine Legs deload')
  })

  it('M4.2: nothing in 7 days is the calendar scene, bare on the stage, with no button', () => {
    show([])
    expect(text()).toContain('Nothing in the last 7 days')
    expect(text()).toContain('When you delete or change something, it waits here for 7 days so you can put it back.')
    expect(view.host.querySelector('.g-sempty')).not.toBeNull()
    expect(view.host.querySelector('.g-sempty-card')).toBeNull()
    expect(view.host.querySelector('.g-sempty svg')).not.toBeNull()
    expect(view.host.querySelector('.g-sempty button')).toBeNull()
    expect(text()).not.toContain('Deletes and changes from the last 7 days')
  })

  it('an entry of a kind from a newer version is a generic row that still has Restore', () => {
    show([entry('x1', 'from-the-future', 0)])
    expect(text()).toContain('Changed something')
    expect(button('Restore: Changed something')).toBeTruthy()
  })
})
