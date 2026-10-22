// Journal kind `measure-delete` (Me > Recent changes): a day's measurements deleted from the Edit
// measurements drawer (views/me/body/measure-drawers.jsx). No UI imports.
//
//   measure-delete  snapshot { before: <the day's entry> }   facts { count }
//
// One check-in a day. A restore puts the day's readings back only while the day is empty: a day that
// holds the very same readings again (the drawer's own Undo) answers `restored`, one logged again with
// other readings `replaced`, and nothing is overwritten. The restored entry is stamped now, so the
// sync takes it over any older copy and over the day's tombstone (lib/me/measure-log.js).
import { recordChange, registerRestorer } from '../recent-changes.js'
import { MEASUREMENT_KEYS } from '../measurements.js'
import { useStore } from '../../store/useStore.js'
import { deleteMeasurementDay, measurementOn, setMeasurementsBack } from './measure-log.js'

export const MEASURE_DELETE = 'measure-delete'

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const filled = v => typeof v === 'number' && Number.isFinite(v) && v > 0

/** A day's readings, by field key ('other:<id>' for a custom one), the empty ones left out. */
export function readingsOf(entry) {
  const out = {}
  if (!entry) return out
  for (const key of MEASUREMENT_KEYS) if (filled(entry[key])) out[key] = entry[key]
  for (const o of entry.other || []) if (o?.id && filled(o.value)) out['other:' + o.id] = o.value
  return out
}

const sameReadings = (a, b) => {
  const x = readingsOf(a), y = readingsOf(b)
  const keys = Object.keys(x)
  return keys.length === Object.keys(y).length && keys.every(k => x[k] === y[k])
}

/** Journals a deleted day of measurements. `before` is the entry removed. */
export function recordMeasureDelete(before) {
  const count = Object.keys(readingsOf(before)).length
  if (!before?.d || !count) return null
  return recordChange({ kind: MEASURE_DELETE, day: before.d, subject: '', facts: { count }, snapshot: { before: clone(before) } })
}

export function restoreMeasureDelete(snap) {
  const before = snap?.before
  if (!before?.d || !Object.keys(readingsOf(before)).length) return { ok: false, reason: 'gone' }
  const now = measurementOn(useStore.getState().S, before.d)
  if (now) return { ok: false, reason: sameReadings(now, before) ? 'restored' : 'replaced' }
  setMeasurementsBack(before)
  return { ok: true, where: { day: before.d } }
}

/** Takes the restored day out again, while it still holds what the restore put back. */
export function undoMeasureDeleteRestore(snap) {
  const before = snap?.before
  if (!before?.d) return { ok: false }
  const now = measurementOn(useStore.getState().S, before.d)
  if (!now || !sameReadings(now, before)) return { ok: false }
  deleteMeasurementDay(before.d)
  return { ok: true }
}

registerRestorer(MEASURE_DELETE, { restore: restoreMeasureDelete, undo: undoMeasureDeleteRestore })
