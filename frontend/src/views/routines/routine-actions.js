import { uid, weekOrder, weekStartOf } from '../../lib/format.js'
import { DEFAULT_GLYPH } from '../../lib/glyphs.js'
import { dateLocale, t, tn } from '../../lib/i18n.js'
import { nav as navigateTo } from '../../lib/nav.js'
import { copyRoutine, deleteRoutine, restoreRoutine, routineSnapshot } from '../../lib/routines.js'
import { markUndone, undoMarks } from '../../lib/sync-merge.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

/* What a routine can have done to it from the Routines page (T4.0), its menu (T5.8) and the +
   sheet. Every change goes through the store's normal update, so sync sees an ordinary edit, and
   each Undo marks what it put back (lib/sync-merge.js undoMarks): a change another device made to
   one of those fields in the meantime still wins. */

// 11 Oct 2026 was a Sunday: weekday `wd` is 11 + wd Oct, said the short way ("Sun").
export const weekdayShort = wd => new Date(2026, 9, 11 + Number(wd), 12).toLocaleDateString(dateLocale(), { weekday: 'short' })

/** "Sun and Thu", in the language on screen. */
export function dayList(names) {
  try { return new Intl.ListFormat(dateLocale(), { style: 'long', type: 'conjunction' }).format(names) } catch { return names.join(', ') }
}

const idsOn = (S, d) => [].concat(S.week?.[d] ?? [])

/** The weekdays a routine is on, in the order the person's week runs. */
export const routineDaysOf = (S, id) => weekOrder(weekStartOf(S)).filter(d => idsOn(S, d).includes(id))

// A new, empty routine, opened in the editor in its T5.6 state (`?new=1`): the Routines page's
// "New routine", the + sheet's and Start a workout's. `go` opens the editor; from a sheet it is
// `to => closeThenNav(close, to)`, so the sheet's history entry is not left behind under the editor.
export function addRoutine(go = navigateTo) {
  const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
  useStore.getState().update(s => { s.routines.push(r) })
  go('/train/routines/' + r.id + '?new=1')
}

/**
 * T4.3's toast for deleting routine `id` from `before` (the state just before): "Deleted Push A.
 * Sun and Thu are now rest days". It names only the weekdays the routine was alone on, since a
 * weekday that keeps another routine is not a rest day; and it counts the dated reschedules that
 * go with it ("and 2 planned dates are cleared"), as deleteRoutine drops both.
 */
export function deletedText(before, id) {
  const name = before.routines.find(r => r.id === id)?.name ?? ''
  const days = weekOrder(weekStartOf(before)).filter(d => { const ids = idsOn(before, d); return ids.length > 0 && ids.every(x => x === id) })
  const dated = Object.values(before.dayPlan || {}).filter(v => v === id).length
  const list = dayList(days.map(weekdayShort))
  const rest = !days.length ? '' : days.length === 1 ? t('{0} is now a rest day', list) : t('{0} are now rest days', list)
  const cleared = !dated ? ''
    : rest ? tn('and {0} planned date is cleared', 'and {0} planned dates are cleared', dated)
      : tn('{0} planned date is cleared', '{0} planned dates are cleared', dated)
  const tail = [rest, cleared].filter(Boolean).join(' ')
  return tail ? t('Deleted {0}. {1}', name, tail) : t('Deleted {0}.', name)
}

/** Deletes a routine with an Undo toast in place of a confirm: the toast puts it back exactly,
 *  list place, weekdays, reschedules and loop included (lib/routines.js routineSnapshot). */
export function deleteRoutineWithUndo(id) {
  const st = useStore.getState()
  const snap = routineSnapshot(st.S, id)
  if (!snap) return false
  const before = st.S
  st.update(s => { deleteRoutine(s, id) })
  // What the removal moved (weekdays, reschedules, the loop), for the Undo to mark as put back:
  // a change another device made to one of them before it saw the removal then still wins.
  snap.marks = undoMarks(before, useStore.getState().S)
  useUI.getState().toast(deletedText(before, id), { action: t('Undo'), onAction: () => undoDeleteRoutine(snap) })
  return true
}
export function undoDeleteRoutine(snap) {
  let ok = false
  useStore.getState().update(s => { ok = restoreRoutine(s, snap); if (ok && snap.marks) markUndone(s, snap.marks) })
  // False when a sync brought it back first (another device's Undo, or its later edit).
  if (!ok) useUI.getState().toast(t('It’s already back.'))
  return ok
}

/** The name a copy of `r` gets: copyRoutine's own, so the menu's line says what the copy is called. */
export const copyNameOf = r => copyRoutine(r, t('Copy')).name

/**
 * A copy of routine `id` right below it, named the way copyRoutine names one, with an Undo that
 * takes the copy away again. A copy is planned nowhere. The swipe stays on the list; the menu's
 * passes `open` and lands in the copy's editor. Returns the copy, or null.
 */
export function duplicateRoutine(id, { open = false, go = navigateTo } = {}) {
  const r = useStore.getState().S.routines.find(x => x.id === id)
  if (!r) return null
  const copy = copyRoutine(r, t('Copy'))
  useStore.getState().update(s => {
    const at = s.routines.findIndex(x => x.id === id)
    s.routines.splice(at < 0 ? s.routines.length : at + 1, 0, copy)
  })
  // The toast takes the place of any Undo still showing (one toast at a time), so the newest
  // copy is at least the one you can take back.
  useUI.getState().toast(t('Copied as “{0}”.', copy.name), { action: t('Undo'), onAction: () => {
    useStore.getState().update(s => { if (s.routines.some(x => x.id === copy.id)) deleteRoutine(s, copy.id) })
  } })
  if (open) go('/train/routines/' + copy.id)
  return copy
}

/**
 * Puts routine `id` on exactly the weekdays `dows` (0 = Sunday), in place on a store draft. A day
 * that holds other routines keeps them and gains this one at the end (a combined day); a day it
 * leaves keeps the rest, and a day left empty loses its key (never `[]`, as DayAssign writes it).
 * Returns null when nothing changed, else `{ added, removed, undo(draft) }`: the Undo takes it off
 * the days it was added to and puts it back at its old place on the days it left, while the
 * routine still exists.
 */
export function setRoutineDays(s, id, dows) {
  const want = new Set(dows.map(Number))
  const added = []
  const removed = {}
  for (let d = 0; d < 7; d++) {
    const ids = idsOn(s, d)
    const on = ids.includes(id)
    if (want.has(d) && !on) {
      if (!s.week) s.week = {}
      s.week[d] = [...ids, id]
      added.push(d)
    } else if (!want.has(d) && on) {
      removed[d] = ids.indexOf(id)
      const next = ids.filter(x => x !== id)
      if (next.length) s.week[d] = next; else delete s.week[d]
    }
  }
  if (!added.length && !Object.keys(removed).length) return null
  const undo = u => {
    for (const d of added) {
      const next = idsOn(u, d).filter(x => x !== id)
      if (next.length) u.week[d] = next; else if (u.week) delete u.week[d]
    }
    if (!u.routines.some(r => r.id === id)) return
    for (const [d, at] of Object.entries(removed)) {
      const ids = idsOn(u, d)
      if (ids.includes(id)) continue
      ids.splice(Math.min(at, ids.length), 0, id)
      if (!u.week) u.week = {}
      u.week[d] = ids
    }
  }
  return { added, removed, undo }
}

/** Saves routine `id`'s Plan days (T5.8's drawer) with an Undo toast. False when nothing changed. */
export function saveRoutineDays(id, dows) {
  const st = useStore.getState()
  const before = st.S
  const name = before.routines.find(r => r.id === id)?.name ?? ''
  let done = null
  st.update(s => { done = setRoutineDays(s, id, dows) })
  if (!done) return false
  const marks = undoMarks(before, useStore.getState().S)
  const days = weekOrder(weekStartOf(before)).filter(d => dows.map(Number).includes(d))
  const text = days.length ? t('{0} is on {1}', name, dayList(days.map(weekdayShort))) : t('{0} is on no weekday', name)
  useUI.getState().toast(text, { action: t('Undo'), onAction: () => useStore.getState().update(s => { done.undo(s); markUndone(s, marks) }) })
  return true
}
