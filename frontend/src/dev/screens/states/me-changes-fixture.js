// What the Recent changes gallery states (me-changes.jsx) show: journal entries as lib/recent-changes.js
// lists them, dated from now so the day headers read Today, Yesterday and "Fri 16 Oct", and an
// in-memory journal with the same five functions. Nothing here touches the real journal or storage:
// a restore only flips a flag in the closure.
import { isoOf } from '../../../lib/format.js'

const DAY = 86400000
const at = (daysAgo, hh, mm) => {
  const d = new Date(Date.now() - daysAgo * DAY)
  d.setHours(hh, mm, 0, 0)
  return d.getTime()
}
const dayOf = daysAgo => isoOf(new Date(Date.now() - daysAgo * DAY))
const entry = (id, kind, daysAgo, hh, mm, rest) => ({
  id, kind, at: at(daysAgo, hh, mm), day: dayOf(daysAgo), subject: '', facts: {}, action: 'restore', state: 'open', ...rest,
})

export const OATS = entry('f1', 'food-delete', 0, 9, 12, { subject: 'Oats with milk', day: dayOf(1), facts: { meal: 'Breakfast', day: dayOf(1), kcal: 380, time: '09:12' } })
export const WEIGH_EDIT = entry('w1', 'weighin-edit', 0, 8, 5, { day: dayOf(3), facts: { from: 81.8, to: 81.7, unit: 'kg' } })
export const COACH = entry('c1', 'coach-move', 1, 21, 30, { subject: 'Legs', action: 'undo', facts: { change: 'moved', weekday: 1, from: 5, to: 1 } })
export const ROUTINE = entry('r1', 'routine-delete', 3, 19, 44, { subject: 'Legs deload', facts: { exercises: 5 } })
export const SET = entry('s1', 'set-delete', 3, 18, 2, { subject: 'Bench press', day: dayOf(6), facts: { day: dayOf(6), weight: 75, reps: 8 } })

// M4.0: the board's five rows across three days.
export const BOARD = [OATS, WEIGH_EDIT, COACH, ROUTINE, SET]

// The kinds the board does not draw.
export const GOAL = entry('g1', 'goal-change', 0, 7, 40, { facts: { what: 'target', from: 80, to: 77, unit: 'kg' } })
export const WORKOUT = entry('k1', 'workout-delete', 1, 20, 15, { subject: 'Pull A', day: dayOf(4), facts: { day: dayOf(4), sets: 18 } })
export const WEIGH_DELETE = entry('w2', 'weighin-delete', 2, 7, 55, { day: dayOf(5), facts: { w: 82.1, unit: 'kg' } })
export const OTHER_KINDS = [GOAL, WORKOUT, WEIGH_DELETE, OATS]

/**
 * An in-memory journal over `entries`. `results` maps an entry id to what its restore answers (default
 * `{ ok: true }`); `restore` flips the entry to restored, `undo` flips it back. Own entries only: the
 * Coach's entry (action 'undo') disappears when restored, as the real Coach log does.
 */
export function memoryJournal(entries, results = {}) {
  let list = entries.map(e => ({ ...e }))
  const listeners = new Set()
  const changed = () => listeners.forEach(fn => fn())
  return {
    list: () => list.map(e => ({ ...e })),
    prune: () => {},
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    restore: async id => {
      const res = results[id] || { ok: true }
      if (res.ok) {
        const found = list.find(e => e.id === id)
        list = found?.action === 'undo' ? list.filter(e => e.id !== id) : list.map(e => (e.id === id ? { ...e, state: 'restored' } : e))
        changed()
      }
      return res
    },
    undo: async id => {
      list = list.map(e => (e.id === id ? { ...e, state: 'open' } : e))
      changed()
      return { ok: true }
    },
  }
}
