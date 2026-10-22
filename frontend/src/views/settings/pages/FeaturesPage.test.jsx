// @vitest-environment happy-dom
// Settings > Features (boards St1Features, St1FoodOff): what the switches write, Food off with
// Undo for 8 s (nothing is deleted), the AI Coach switch that stays off, and the slot Friends fills.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, user: null, ctx: null, toast: vi.fn(), navs: [], friends: [], soon: true }
  state.snapshot = () => ({
    S: state.S, user: state.user,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../../../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../../../store/useUI.js', () => {
  const snap = () => ({ toast: mocks.toast })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => (...a) => mocks.navs.push(a) }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))
vi.mock('../../../lib/coach-availability.js', () => ({ get COACH_COMING_SOON() { return mocks.soon } }))
vi.mock('../use-settings-ctx.js', () => ({ useSettingsCtx: () => mocks.ctx }))
vi.mock('../../../lib/nutrition/api.js', () => ({ nutritionAvailable: user => !!user }))
vi.mock('../../../lib/nutrition/use-fasting.js', () => ({ setFastingEnabled: vi.fn() }))
vi.mock('./features-rows.js', () => ({ friendsRow: () => mocks.friends }))

import FeaturesPage from './FeaturesPage.jsx'

let host, root
beforeEach(() => {
  mocks.S = { trackTraining: true, trackFood: true, trackActivity: true, haptics: true }
  mocks.user = { id: 1, name: 'Ana' }
  mocks.ctx = { nutrition: true, ntSettings: { fastingEnabled: false }, fastingOn: false, user: mocks.user }
  mocks.soon = true
  mocks.friends = []
  mocks.navs = []
  mocks.toast.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<FeaturesPage />))
const row = title => [...host.querySelectorAll('.g-glist-row')].find(r => r.querySelector('b')?.textContent === title)
const sw = title => row(title).querySelector('[role="switch"]')
const flip = title => act(() => { sw(title).click() })

describe('What you track', () => {
  it('lists Training, Food and Activity with their sublines, all on in a new profile', () => {
    mount()
    expect(['Training', 'Food', 'Activity'].map(t => sw(t).getAttribute('aria-checked'))).toEqual(['true', 'true', 'true'])
    expect(row('Food').querySelector('.g-glist-body span').textContent).toBe('Diary, foods, water, the calorie ring')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Training, Food, Activity · Fasting off')
  })

  it('turning Food off writes trackFood, says the diary is kept, and offers Undo for 8 seconds', () => {
    mount()
    flip('Food')
    expect(mocks.S.trackFood).toBe(false)
    expect(mocks.toast).toHaveBeenCalledTimes(1)
    const [message, opts] = mocks.toast.mock.calls[0]
    expect(message).toBe('Stopped tracking food. Your diary is kept')
    expect(opts.action).toBe('Undo')
    // Nothing else changed: no diary, setting or other switch was touched.
    expect(mocks.S).toEqual({ trackTraining: true, trackFood: false, trackActivity: true, haptics: true })
    opts.onAction()
    expect(mocks.S.trackFood).toBe(true)
  })

  it('with Food off the row reads "Off · your diary is kept" and the line names it', () => {
    mocks.S.trackFood = false
    mocks.ctx = { ...mocks.ctx, nutrition: false }
    mount()
    expect(row('Food').querySelector('.g-glist-body span').textContent).toBe('Off · your diary is kept')
    expect(sw('Food').getAttribute('aria-checked')).toBe('false')
    expect(host.querySelector('.g-sptitle p').textContent).toBe('Training, Activity · Food off')
  })

  it('turning Food on again is one write and no toast', () => {
    mocks.S.trackFood = false
    mocks.ctx = { ...mocks.ctx, nutrition: false }
    mount()
    flip('Food')
    expect(mocks.S.trackFood).toBe(true)
    expect(mocks.toast).not.toHaveBeenCalled()
  })

  it('keeps one of Training and Food on: the last one cannot be turned off', () => {
    mocks.S.trackTraining = false
    mount()
    expect(sw('Food').disabled).toBe(true)
    expect(sw('Training').disabled).toBe(false)
    flip('Food')
    expect(mocks.S.trackFood).toBe(true)
  })

  it('without a diary (the phone app, a guest) there is no Food row and Training stays on', () => {
    mocks.user = null
    mocks.ctx = { ...mocks.ctx, nutrition: false }
    mount()
    expect(row('Food')).toBeUndefined()
    expect(sw('Training').disabled).toBe(true)
  })

  it('Training and Activity write their own keys', () => {
    mount()
    flip('Activity')
    expect(mocks.S.trackActivity).toBe(false)
    flip('Training')
    expect(mocks.S.trackTraining).toBe(false)
  })
})

describe('Features', () => {
  it('AI Coach stays off and disabled while it is coming soon', () => {
    mount()
    expect(sw('AI Coach').disabled).toBe(true)
    expect(sw('AI Coach').getAttribute('aria-checked')).toBe('false')
    expect(row('AI Coach').querySelector('.g-glist-body span').textContent).toBe('Coming soon')
    flip('AI Coach')
    expect(mocks.S).toEqual({ trackTraining: true, trackFood: true, trackActivity: true, haptics: true })
  })

  it('shows what Friends adds, and nothing when the slot is empty', () => {
    mount()
    expect(row('Friends')).toBeUndefined()
    act(() => root.unmount())
    root = createRoot(host)
    const onChange = vi.fn()
    mocks.friends = [{ key: 'friends', icon: 'users', title: 'Friends', sub: 'Groups under Me', checked: false, onChange }]
    mount()
    flip('Friends')
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('has no Food-only rows when food is off', () => {
    mocks.ctx = { ...mocks.ctx, nutrition: false }
    mount()
    expect(row('Fasting')).toBeUndefined()
    expect(row('Water')).toBeUndefined()
  })

  it('opens the page of a switch that starts off, with that switch to flash', () => {
    mount()
    act(() => row('Flash the screen').click())
    expect(mocks.navs.at(-1)).toEqual(['/me/workout', { state: { find: 'Flash the screen' } }])
  })
})
