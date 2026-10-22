// Recent changes (Me, boards M4.0 to M4.2): the journal's entries worded and grouped by day. The
// journal holds no UI strings (lib/recent-changes.js): `subject` is the person's own data and `facts`
// is structured, so every sentence is made here, one formatter per kind. Pure; no JSX.
import { dateLocale, t, tn } from '../../../lib/i18n.js'
import { exCount, fmtDate, fmtNum, isoOf } from '../../../lib/format.js'
import { movementLabel } from '../goal/goal-data.js'

const DAY_MS = 86400000
const SEP = ' · '

// Reasons that mean the thing is already where it should be, not that the restore failed.
const ALREADY = ['replaced', 'restored']

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const clean = list => list.filter(Boolean)
const joinParts = list => clean(list).join(SEP)
const dateOf = iso => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? fmtDate(iso, true) : '')

/** "09:12", in the UI language's clock. */
export const timeOf = at => new Date(at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })

/** A weekday (Sunday = 0) as a name in the UI language. */
export function weekdayName(d) {
  const n = num(d)
  if (n === null) return ''
  return new Date(2024, 0, 7 + (((n % 7) + 7) % 7), 12).toLocaleDateString(dateLocale(), { weekday: 'long' })
}

const amount = (v, unit) => (num(v) === null ? '' : joinUnit(fmtNum(v), unit))
const joinUnit = (n, unit) => (unit ? `${n} ${unit}` : n)
const arrow = (from, to) => (from && to ? t('{0} → {1}', from, to) : '')

const GOALS = { lose: 'Lose', keep: 'Keep', build: 'Build' }
function goalName(v) {
  const key = typeof v === 'string' ? v.toLowerCase() : v === 0.8 ? 'lose' : v === 1 ? 'keep' : v === 1.1 ? 'build' : ''
  switch (GOALS[key]) {
    case 'Lose': return t('Lose')
    case 'Keep': return t('Keep')
    case 'Build': return t('Build')
    default: return typeof v === 'string' ? v : ''
  }
}

const sexName = v => (v === 'male' ? t('Male') : v === 'female' ? t('Female') : '')
const plainYear = v => (num(v) === null ? '' : String(v))
const kcal = v => (num(v) === null ? '' : t('{0} kcal', fmtNum(v)))
const moved = (from, to) => arrow(from, to) || to

// What a goal-change moved, from its facts { what, from, to, unit? }: the old and new value, or the
// new one alone.
function goalDetail(facts, ctx) {
  const { what } = facts
  const unit = facts.unit || ctx.unit
  const from = facts.from ?? null, to = facts.to ?? null
  switch (what) {
    case 'goal': return moved(goalName(from), goalName(to))
    case 'target': return moved(amount(from, unit), amount(to, unit))
    case 'body': {
      const a = from || {}, b = to || {}
      const cm = v => (num(v) === null ? '' : joinUnit(fmtNum(v), t('cm')))
      return joinParts([
        a.heightCm !== b.heightCm ? moved(cm(a.heightCm), cm(b.heightCm)) : '',
        a.birthYear !== b.birthYear ? moved(plainYear(a.birthYear), plainYear(b.birthYear)) : '',
        a.sex !== b.sex ? moved(sexName(a.sex), sexName(b.sex)) : '',
      ])
    }
    case 'movement': return moved(movementLabel(from) || '', movementLabel(to) || '')
    case 'targets': return moved(kcal(from?.calories), kcal(to?.calories))
    default: return ''
  }
}

/** What happened, as a sentence ("Deleted Oats with milk"). `ctx.unit` is the person's weight unit. */
export function entryTitle(entry, ctx = {}) {
  const { kind, subject = '', facts = {} } = entry
  switch (kind) {
    case 'weighin-edit': return t('Changed a weigh-in')
    case 'weighin-delete': return t('Deleted a weigh-in')
    case 'photo-delete': return t('Deleted a photo')
    case 'measure-delete': return t('Deleted measurements')
    case 'goal-change': {
      switch (facts.what) {
        case 'target': return num(facts.to) === null ? t('Target weight changed') : t('Target weight changed to {0}', amount(facts.to, facts.unit || ctx.unit))
        case 'goal': return goalName(facts.to) ? t('Goal changed to {0}', goalName(facts.to)) : t('Goal changed')
        case 'body': return t('Body details changed')
        case 'movement': return t('Daily movement changed')
        case 'targets': return t('Daily targets changed')
        default: return t('Goal settings changed')
      }
    }
    case 'routine-delete': return subject ? t('Deleted routine {0}', subject) : t('Deleted a routine')
    case 'workout-delete': return subject ? t('Deleted workout {0}', subject) : t('Deleted a workout')
    case 'set-delete': return t('Deleted a set')
    case 'food-delete': return subject ? t('Deleted {0}', subject) : t('Deleted a food')
    case 'coach-move': {
      switch (facts.change) {
        case 'moved': return t('Coach moved {0}', subject)
        case 'set': return subject && weekdayName(facts.to) ? t('Coach put {0} on {1}', subject, weekdayName(facts.to)) : t('Coach changed your plan')
        case 'rest-day': return weekdayName(facts.from) ? t('Coach made {0} a rest day', weekdayName(facts.from)) : t('Coach made a rest day')
        case 'added': return t('Coach added {0}', subject)
        case 'removed': return t('Coach removed {0}', subject)
        case 'renamed': return t('Coach renamed a routine')
        default: return t('Coach changed your plan')
      }
    }
    default: return t('Changed something')
  }
}

/** The line under the title: where it was, the numbers, and the time it happened. */
export function entryDetail(entry, ctx = {}) {
  const { kind, subject = '', facts = {}, day, at } = entry
  const time = timeOf(at)
  switch (kind) {
    case 'weighin-edit': {
      const unit = facts.unit || ctx.unit
      return joinParts([dateOf(day), arrow(amount(facts.from), amount(facts.to, unit)), time])
    }
    case 'weighin-delete': {
      const unit = facts.unit || ctx.unit
      return joinParts([dateOf(day), amount(facts.weight, unit), time])
    }
    case 'photo-delete': return joinParts([dateOf(day), time])
    case 'measure-delete': return joinParts([dateOf(day), num(facts.count) === null ? '' : tn('{0} measurement', '{0} measurements', facts.count), time])
    case 'goal-change': return joinParts([goalDetail(facts, ctx), time])
    case 'routine-delete': return joinParts([num(facts.exercises) === null ? '' : exCount(facts.exercises), time])
    case 'workout-delete': return joinParts([dateOf(facts.day || day), num(facts.sets) === null ? '' : tn('{0} set', '{0} sets', facts.sets), time])
    case 'set-delete': {
      const w = num(facts.weight), r = num(facts.reps)
      const load = w !== null && r !== null ? t('{0} × {1}', amount(w, ctx.unit), fmtNum(r)) : w !== null ? amount(w, ctx.unit) : r !== null ? tn('{0} rep', '{0} reps', r) : ''
      const where = clean([subject, dateOf(facts.day || day)]).join(', ')
      return joinParts([where, load, time])
    }
    case 'food-delete': {
      const where = clean([facts.meal, dateOf(facts.day)]).join(', ')
      return joinParts([where, num(facts.kcal) === null ? '' : t('{0} kcal', fmtNum(facts.kcal)), typeof facts.time === 'string' ? facts.time : time])
    }
    case 'coach-move': {
      switch (facts.change) {
        case 'moved': return joinParts([arrow(weekdayName(facts.from), weekdayName(facts.to)), time])
        case 'rest-day': return joinParts([subject, time])
        case 'renamed': return joinParts([arrow(facts.from, facts.to), time])
        default: return time
      }
    }
    default: return time
  }
}

/** True when the Restore is really an Undo (the Coach's own log). */
export const isUndo = entry => entry.action === 'undo'

/** Entries by the day they were made, newest first: [{ key, label, items }]. `now` words Today and Yesterday. */
export function groupByDay(entries, now = Date.now()) {
  const today = isoOf(new Date(now))
  const yesterday = isoOf(new Date(now - DAY_MS))
  const out = []
  for (const entry of [...entries].sort((a, b) => b.at - a.at)) {
    const key = isoOf(new Date(entry.at))
    let group = out[out.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: key === today ? t('Today') : key === yesterday ? t('Yesterday') : fmtDate(key, true), items: [] }
      out.push(group)
    }
    group.items.push(entry)
  }
  return out
}

/** A restore that answered `replaced` or `restored`: it is already back, not an error. */
export function isAlready(entry, reason) {
  if (!ALREADY.includes(reason)) return false
  // One weigh-in, and one check-in of measurements, a day: "replaced" there means the day now holds
  // other readings.
  return !(reason === 'replaced' && (entry.kind.startsWith('weighin-') || entry.kind === 'measure-delete'))
}

/** The toast after a successful restore. */
export function restoredMessage(entry, result = {}) {
  const { kind, subject = '' } = entry
  const where = result.where || {}
  switch (kind) {
    case 'food-delete': {
      const day = dateOf(where.day || entry.facts?.day || entry.day)
      if (result.fellBack === 'snacks') {
        return entry.facts?.meal
          ? t('Restored {0} to {1}, {2}. {3} was deleted.', subject, day, t('Snacks'), entry.facts.meal)
          : t('Restored {0} to {1}, {2}', subject, day, t('Snacks'))
      }
      return where.meal ? t('Restored {0} to {1}, {2}', subject, day, where.meal) : t('Restored {0} to {1}', subject, day)
    }
    case 'routine-delete': return subject ? t('Restored {0}', subject) : t('Restored the routine')
    case 'workout-delete': return dateOf(where.day) ? t('Restored the workout on {0}', dateOf(where.day)) : t('Restored the workout')
    case 'set-delete': return t('Restored the set')
    case 'weighin-edit':
    case 'weighin-delete': return dateOf(entry.day) ? t('Restored the weigh-in on {0}', dateOf(entry.day)) : t('Restored the weigh-in')
    case 'photo-delete': return t('Restored the photo')
    case 'measure-delete': return dateOf(entry.day) ? t('Restored the measurements on {0}', dateOf(entry.day)) : t('Restored the measurements')
    case 'goal-change': return t('Restored your previous goal settings')
    case 'coach-move': return t('Plan restored')
    default: return t('Restored')
  }
}

/** The toast for a restore that did not happen: the honest reason. */
export function failureMessage(entry, reason) {
  if (isUndo(entry)) return reason === 'gone' ? t('Couldn’t undo: there’s nothing to undo') : t('Couldn’t undo. Try again.')
  switch (reason) {
    case 'gone': return entry.kind === 'photo-delete' ? t('Couldn’t restore that photo') : /^(workout|set)-/.test(entry.kind) ? t('Couldn’t restore: the workout is gone') : t('Couldn’t restore: it’s gone')
    case 'replaced': return entry.kind === 'measure-delete' ? t('Couldn’t restore: that day already has measurements') : t('Couldn’t restore: that day already has a weigh-in')
    case 'changed': return t('Couldn’t restore: it changed since')
    case 'unsupported': return t('Couldn’t restore: this version can’t put that back')
    default: return t('Couldn’t restore. Check your connection and try again.')
  }
}
