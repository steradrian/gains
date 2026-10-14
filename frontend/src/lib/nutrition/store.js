import { create } from 'zustand'
import { NtApi } from './api.js'
import { addPayload, removePayload, foodItem, quickCaloriesItem, waterLog, atPortion } from './diary.js'
import { offResults } from './off.js'
import { useDiarySelection } from './selection.js'
import { useStore } from '../../store/useStore.js'

// NutriTrace's data as the app shows it: the diary per date, the settings it adds up against,
// the day's activity rows, the target's inputs and your foods. Server state read through the hub
// (api.js), cached per date so going back a day and forward again does not reload.
//
// Writes are not optimistic. A write that fails throws (an NtError, api.js) to the sheet that
// made it, which keeps what was typed and says so; the day on screen moves once NutriTrace has
// the change, from the day the PUT answers with.
//
// Every `status` is 'idle' | 'loading' | 'ready' | 'error'.

const initial = () => ({
  settings: { status: 'idle', data: null, error: null },
  days: {},
  activity: {},
  goalInputs: {},
  foods: { status: 'idle', list: [], error: null },
  logged: { status: 'idle', days: new Set(), error: null },
})

const ADAPTIVE_KEY = 'adaptive'
const withImg = ({ img_url, ...f }) => ({ ...f, imgUrl: img_url || f.imgUrl || '' })

export const useNutrition = create((set, get) => {
  const patchDay = (date, patch) => set(s => ({ days: { ...s.days, [date]: { ...s.days[date], ...patch } } }))
  const storeDay = (date, entry) => {
    patchDay(date, { status: 'ready', entry, error: null })
    const logged = get().logged
    if (logged.status === 'ready' && (entry?.items?.length > 0) !== logged.days.has(date)) {
      const days = new Set(logged.days)
      if (entry?.items?.length > 0) days.add(date); else days.delete(date)
      set({ logged: { ...logged, days } })
    }
  }

  async function write(date, payload) {
    const entry = await NtApi.saveDiaryDate(date, payload)
    storeDay(date, entry)
    return entry
  }

  // The food as NutriTrace stores it: an online result is saved as one of your foods first
  // (Foods.svelte _addFoodToDiaryNoNav), so the diary item points at a food you can find again.
  async function ownFood(food) {
    if (typeof food.id === 'number') return food
    const { id: _drop, imgUrl, ...rest } = food
    const saved = withImg(await NtApi.createFood({ ...rest, img_url: imgUrl || null, created_at: new Date().toISOString() }))
    set(s => ({ foods: { ...s.foods, list: [...s.foods.list.filter(f => f.id !== saved.id), saved] } }))
    return saved
  }

  return {
    ...initial(),

    reset: () => set(initial()),

    /** @returns {Promise<import('./api.js').NtSettings|null>} the settings, or the last ones on failure */
    async loadSettings({ force = false } = {}) {
      const cur = get().settings
      if (!force && cur.status === 'ready') return cur.data
      set({ settings: { ...cur, status: 'loading' } })
      try {
        const data = await NtApi.getSettings()
        set({ settings: { status: 'ready', data, error: null } })
        return data
      } catch (e) {
        set({ settings: { status: 'error', data: cur.data, error: e } })
        return cur.data
      }
    },

    async loadDay(date, { force = false } = {}) {
      const cur = get().days[date]
      if (!force && cur && (cur.status === 'ready' || cur.status === 'loading')) return
      patchDay(date, { status: 'loading' })
      try {
        storeDay(date, await NtApi.getDiaryDate(date))
      } catch (e) {
        patchDay(date, { status: 'error', error: e })
      }
    },

    // Activity rows (the workout entry and "Covered by" among them) and the effective active kcal
    // the target may add. A failure leaves the rows out; the diary still adds up.
    async loadActivity(date, policy) {
      try {
        const [rows, sum] = await Promise.all([NtApi.getActivity(date), NtApi.getActivitySum(date, policy)])
        set(s => ({ activity: { ...s.activity, [date]: { status: 'ready', rows: Array.isArray(rows) ? rows : [], sum, error: null } } }))
      } catch (e) {
        set(s => ({ activity: { ...s.activity, [date]: { status: 'error', rows: [], sum: null, error: e } } }))
      }
    },

    // What a Dynamic or Adaptive target is computed from (Diary.svelte _loadDynamicGoal,
    // _loadAdaptiveTdee). Null means the target falls back to the fixed goal, as there.
    async loadGoalInputs(date, mode) {
      if (mode === 'dynamic' && !(date in get().goalInputs)) {
        let out = null
        try { out = (await NtApi.getCaloriesOut(date))?.calories_out ?? null } catch { out = null }
        set(s => ({ goalInputs: { ...s.goalInputs, [date]: out } }))
      }
      if (mode === 'adaptive' && !(ADAPTIVE_KEY in get().goalInputs)) {
        let tdee = null
        try { const r = await NtApi.getAdaptiveTdee(); tdee = r?.ready ? r.tdee : null } catch { tdee = null }
        set(s => ({ goalInputs: { ...s.goalInputs, [ADAPTIVE_KEY]: tdee } }))
      }
    },
    caloriesOut: date => get().goalInputs[date] ?? null,
    adaptiveTdee: () => get().goalInputs[ADAPTIVE_KEY] ?? null,

    async loadFoods({ force = false } = {}) {
      const cur = get().foods
      if (!force && (cur.status === 'ready' || cur.status === 'loading')) return
      set({ foods: { ...cur, status: 'loading' } })
      try {
        const rows = await NtApi.getFoods()
        set({ foods: { status: 'ready', list: (Array.isArray(rows) ? rows : []).map(withImg), error: null } })
      } catch (e) {
        set({ foods: { ...cur, status: 'error', error: e } })
      }
    },

    // The days with food logged (the calendar's marks).
    async loadLogged() {
      if (get().logged.status === 'loading') return
      set(s => ({ logged: { ...s.logged, status: 'loading' } }))
      try {
        const rows = await NtApi.getAllDiary()
        const days = new Set((Array.isArray(rows) ? rows : []).filter(r => r?.items?.length > 0).map(r => r.date))
        set({ logged: { status: 'ready', days, error: null } })
      } catch (e) {
        set(s => ({ logged: { ...s.logged, status: 'error', error: e } }))
      }
    },

    /** Online results for a search, mapped to unsaved foods (off.js). Throws an NtError. */
    async searchOnline(query, lang) {
      return offResults(await NtApi.searchOnline(query, { lang }), lang)
    },

    /** Logs `food` (yours, or an online result, saved first) at (portion, unit) × servings to the
     *  date's meal. Resolves to the item logged. */
    async logFood({ date, meal, food, portion, unit, servings }) {
      const saved = await ownFood(food)
      const item = foodItem(atPortion(saved, portion ?? saved.portion, unit ?? saved.unit), { meal, quantity: servings })
      await write(date, addPayload({ items: [item] }))
      // Recents order by this (POST /api/foods/:id/used). Fire and forget, as NutriTrace does.
      if (typeof saved.id === 'number') {
        NtApi.markFoodUsed(saved.id, date).catch(() => {})
        set(s => ({
          foods: {
            ...s.foods,
            list: s.foods.list.map(f => (f.id === saved.id
              ? { ...f, last_used_at: f.last_used_at && f.last_used_at > date ? f.last_used_at : date, usage_count: (f.usage_count || 0) + 1 }
              : f)),
          },
        }))
      }
      return item
    },

    /** Quick kcal (with optional macros) to the date's meal. Throws { code: 'invalid' } without a
     *  positive kcal. */
    async logQuick({ date, meal, kcal, name, proteins, carbohydrates, fat }) {
      const item = quickCaloriesItem({ kcal, name, proteins, carbohydrates, fat, meal })
      if (!item) throw Object.assign(new Error('kcal required'), { status: 0, code: 'invalid' })
      await write(date, addPayload({ items: [item] }))
      return item
    },

    async logWater({ date, ml }) {
      const log = waterLog(ml, { hour12: get().settings.data?.timeFormat !== '24h' })
      await write(date, addPayload({ water: [log] }))
      return log
    },

    // Undo of a log just made: a tombstone for its uuid (deleted_uuids).
    removeItem: (date, uuid) => write(date, removePayload({ items: [uuid] })),
    removeWater: (date, uuid) => write(date, removePayload({ water: [uuid] })),
  }
})

// Another account signing in on this device never sees the last one's data or picks.
const who = s => (s.user ? String(s.user.id ?? s.user.name ?? '') : '')
useStore.subscribe((s, prev) => {
  if (who(s) === who(prev)) return
  useNutrition.getState().reset()
  useDiarySelection.getState().reset()
})
