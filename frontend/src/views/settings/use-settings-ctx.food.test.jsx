// @vitest-environment happy-dom
// Food turned off (Settings > Features) hides the Food side of Settings through ctx.nutrition,
// which every page, the root and the search read; turning it back on restores it. Nothing else in
// the ctx moves.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({ S: null, user: null }))

vi.mock('../../store/useStore.js', () => {
  const snap = () => ({ S: mocks.S, user: mocks.user, sync: null, config: null })
  const useStore = selector => selector ? selector(snap()) : snap()
  useStore.getState = snap
  return { useStore }
})
vi.mock('../../lib/api.js', () => ({ webauthnOK: () => false, IS_ANDROID: false }))
vi.mock('../../lib/push.js', () => ({ pushSupported: () => false }))
vi.mock('../../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false) }))
vi.mock('../../components/PasswordAuth.jsx', () => ({ passwordOn: () => false }))
vi.mock('../../lib/nutrition/store.js', () => {
  const state = { settings: { data: null, status: 'idle' }, loadSettings: vi.fn() }
  const useNutrition = selector => selector(state)
  useNutrition.getState = () => state
  return { useNutrition }
})

import { pageVisible } from '../settings-pages.js'
import { useSettingsCtx } from './use-settings-ctx.js'
import { foodTracked } from '../../lib/nutrition/food-tracked.js'

let host, root, ctx
function Probe() { ctx = useSettingsCtx(); return null }
const BASE = { lang: 'en', workouts: [], routines: [], exWeights: {} }

beforeEach(() => {
  mocks.S = { ...BASE }
  mocks.user = { id: 1, name: 'Ana' }
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = () => act(() => root.render(<Probe />))

describe('ctx.nutrition and the Food switch', () => {
  it('is on for a signed-in web profile that never touched the switch', () => {
    mount()
    expect(foodTracked(mocks.S)).toBe(true)
    expect(ctx.nutrition).toBe(true)
    expect(pageVisible('diary', ctx)).toBe(true)
    expect(pageVisible('water', ctx)).toBe(true)
  })

  it('Food off hides the Food pages and Fasting, and turning it back on restores them', () => {
    mocks.S = { ...BASE, trackFood: false }
    mount()
    expect(ctx.nutrition).toBe(false)
    expect(pageVisible('diary', ctx)).toBe(false)
    expect(pageVisible('foods', ctx)).toBe(false)
    expect(pageVisible('goals', ctx)).toBe(false)
    act(() => root.unmount())
    root = createRoot(host)
    mocks.S = { ...BASE, trackFood: true }
    mount()
    expect(ctx.nutrition).toBe(true)
    expect(pageVisible('diary', ctx)).toBe(true)
  })

  it('a guest has no Food either way', () => {
    mocks.user = null
    mount()
    expect(ctx.nutrition).toBe(false)
  })
})
