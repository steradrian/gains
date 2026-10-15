import { create } from 'zustand'
import { NtApi } from './api.js'
import { useNutrition } from './store.js'
import { FETCH_DAYS, mergeSources } from './wellness.js'
import { useStore } from '../../store/useStore.js'
import { isoOf } from '../format.js'

// What Progress › Trends and Recovery read, through the hub (api.js): every diary day NutriTrace
// has (GET /api/diary, as its Statistics page reads it) and the wearable's days. Server state,
// read once and kept, so the hub's cards and the pages agree and a range change never asks again.
// A failed read leaves what was there and reports the error; `load({ force })` asks again.
//
// `status` is 'idle' | 'loading' | 'ready' | 'error'.

const idle = () => ({ status: 'idle', days: [], error: null })

// Bumped when the account changes, so an answer for the account before never lands in the next.
let gen = 0

export const useTrends = create((set, get) => ({
  ...idle(),

  reset() {
    gen += 1
    set(idle())
  },

  async load({ force = false } = {}) {
    const cur = get()
    if (!force && (cur.status === 'ready' || cur.status === 'loading')) return
    const g = gen
    if (cur.status !== 'ready') set({ status: 'loading' })
    try {
      const days = await NtApi.getAllDiary()
      if (g === gen) set({ status: 'ready', error: null, days: Array.isArray(days) ? days : [] })
    } catch (e) {
      if (g === gen) set({ status: cur.status === 'ready' ? 'ready' : 'error', error: e })
    }
  },
}))

const wellnessIdle = () => ({ status: 'idle', byDate: {}, error: null })
let wellnessGen = 0

// The settings say which wearables are connected (booleans, never credentials: the hub passes
// these four keys). A person with none costs no request.
const connected = settings => ({
  fitbit: !!(settings?.fitbitEnabled || settings?.googleHealthEnabled || settings?.healthConnectEnabled),
  garmin: !!settings?.garminEnabled,
})

export const useWellness = create((set, get) => ({
  ...wellnessIdle(),

  reset() {
    wellnessGen += 1
    set(wellnessIdle())
  },

  /** Reads the last year of both sources (one that fails does not hide the other) once the
   *  settings are known. Nothing is asked for without a connected wearable. */
  async load({ force = false } = {}) {
    const cur = get()
    if (!force && (cur.status === 'ready' || cur.status === 'loading')) return
    const g = wellnessGen
    if (cur.status !== 'ready') set({ status: 'loading' })
    const settings = await useNutrition.getState().loadSettings()
    if (g !== wellnessGen) return
    if (!settings) {
      set({ status: cur.status === 'ready' ? 'ready' : 'error', error: useNutrition.getState().settings.error })
      return
    }
    const on = connected(settings)
    if (!on.fitbit && !on.garmin) {
      set({ status: 'ready', error: null, byDate: {} })
      return
    }
    const to = isoOf(new Date())
    const from = isoOf(new Date(Date.now() - (FETCH_DAYS - 1) * 86400000))
    const [fitbit, garmin] = await Promise.allSettled([
      on.fitbit ? NtApi.getWellness('fitbit', from, to) : Promise.resolve(null),
      on.garmin ? NtApi.getWellness('garmin', from, to) : Promise.resolve(null),
    ])
    if (g !== wellnessGen) return
    if (fitbit.status === 'rejected' && garmin.status === 'rejected') {
      set({ status: cur.status === 'ready' ? 'ready' : 'error', error: fitbit.reason })
      return
    }
    set({
      status: 'ready',
      error: null,
      byDate: mergeSources(fitbit.status === 'fulfilled' ? fitbit.value : null, garmin.status === 'fulfilled' ? garmin.value : null),
    })
  },
}))

// Another account signing in on this device never sees the last one's diary or wearable.
const who = s => (s.user ? String(s.user.id ?? s.user.name ?? '') : '')
if (typeof useStore.subscribe === 'function') {
  useStore.subscribe((s, prev) => {
    if (who(s) !== who(prev)) {
      useTrends.getState().reset()
      useWellness.getState().reset()
    }
  })
}
