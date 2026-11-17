// What the Log measurements and Choose measurements drawers do to the state (views/me/body/
// measure-drawers.jsx), ported from the old views/Measurements.jsx. No UI imports.
//
// S.measurements = one entry per day (lib/measurements.js), lengths in centimetres whatever the
// profile's unit; the form shows and reads inches for a pound profile. An empty field stays empty:
// it is never saved as a zero. Every write leaves the list in its one-entry-per-day shape
// (normalizeMeasurementsState).
import { todayISO, uid } from '../format.js'
import {
  MEASUREMENT_FIELDS, emptyMeasurement, enabledMeasurementFields, fromMeasurementDisplay,
  measurementEntryHasValues, measurementUnit, measurementValue, normalizeMeasurementEntry,
  normalizeMeasurementsState, toMeasurementDisplay,
} from '../measurements.js'
import { useStore } from '../../store/useStore.js'
import { syncNow } from '../nutrition/sync.js'

const clone = v => JSON.parse(JSON.stringify(v))
const write = (fn, ...rest) => useStore.getState().update(s => { fn(s); normalizeMeasurementsState(s) }, ...rest)

/** The unit a field is typed in: % for body fat, else cm (kg profiles) or in (lb profiles). */
export const fieldUnit = (field, profileUnit) => (field.key === 'bodyFat' ? '%' : measurementUnit(profileUnit))

/** The value of `field` in `entry` as the form shows it, or null. */
export function shownValue(entry, field, profileUnit) {
  const value = measurementValue(entry, field.key)
  if (value == null) return null
  return field.key === 'bodyFat' ? value : toMeasurementDisplay(value, profileUnit)
}

/** The entry for `day` in `S`, or null. */
export const measurementOn = (S, day) => (Array.isArray(S?.measurements) ? S.measurements.find(e => e.d === day) : null) || null

/**
 * The fields the form offers: the ones the person tracks, plus, when editing a day, any field that day
 * has a value in even if it has since been switched off (so editing never hides a number).
 */
export function logFields(S, source = null) {
  const fields = [...enabledMeasurementFields(S)]
  if (!source) return fields
  for (const f of MEASUREMENT_FIELDS) {
    if (source[f.key] != null && !fields.some(x => x.key === f.key)) fields.push(f)
  }
  for (const o of source.other || []) {
    if (o.value != null && !fields.some(x => x.key === 'other:' + o.id)) {
      fields.push({ key: 'other:' + o.id, label: o.name, custom: true, group: 'Other' })
    }
  }
  return fields
}

/** The form's starting text per field key: the day's value, or '' for a field left empty. */
export function startTexts(source, fields, profileUnit) {
  const out = {}
  for (const f of fields) {
    const v = source ? shownValue(source, f, profileUnit) : null
    out[f.key] = v == null ? '' : String(v)
  }
  return out
}

/** The number typed, to one decimal; null for empty or anything that is not a positive number. */
export function parseValue(text) {
  const n = Number(String(text ?? '').trim().replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null
}

/**
 * The entry to save, or why not. `date` is the day typed; `sourceDate` the day being edited (null for a
 * new one); `texts` is what each field holds, by key. Reasons: `date` (not a day, or a day to come),
 * `duplicate` (that day has an entry and is not the one being edited), `bodyFat` (over 100), `empty`
 * (nothing filled in).
 */
export function buildEntry({ S, sourceDate = null, date, texts, fields, now = Date.now() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) return { ok: false, reason: 'date' }
  if (date !== sourceDate && measurementOn(S, date)) return { ok: false, reason: 'duplicate' }
  const source = sourceDate ? measurementOn(S, sourceDate) : null
  const base = source ? normalizeMeasurementEntry(source, S.customMeasurements) : emptyMeasurement(date, S.customMeasurements)
  base.d = date
  for (const field of fields) {
    const value = parseValue(texts[field.key])
    if (field.key === 'bodyFat' && value > 100) return { ok: false, reason: 'bodyFat' }
    if (field.custom) {
      const item = base.other.find(o => o.id === field.key.slice(6))
      if (item) item.value = value == null ? null : fromMeasurementDisplay(value, S.unit)
    } else if (field.key === 'bodyFat') base.bodyFat = value
    else base[field.key] = value == null ? null : fromMeasurementDisplay(value, S.unit)
  }
  if (!measurementEntryHasValues(base)) return { ok: false, reason: 'empty' }
  // `t` is when the check-in was last saved: the newer one of a day wins a sync merge, the way a
  // weigh-in's does. The chart places it by its date, not by this.
  base.t = now
  return { ok: true, entry: base }
}

/** Saves `entry`, replacing the entry of `sourceDate` (the day being edited) when there is one. */
export function saveMeasurementEntry(entry, sourceDate = null) {
  write(state => {
    if (sourceDate) state.measurements = state.measurements.filter(e => e.d !== sourceDate)
    state.measurements.push(entry)
  })
}

/**
 * Takes `day`'s check-in out. Returns a copy of the entry removed, or null. The store's change
 * records the removal in `deleted.measurements` (stampDeletions), so the sync drops the day on every
 * device whose copy of it is older than the delete.
 */
export function deleteMeasurementDay(day) {
  let removed = null
  write(state => {
    const entry = state.measurements.find(e => e.d === day)
    if (!entry) return
    removed = clone(entry)
    state.measurements = state.measurements.filter(e => e.d !== day)
  })
  if (removed) void syncNow()
  return removed
}

/**
 * Puts `entry` back as its day's check-in, stamped now so the sync takes it over any older copy of the
 * day; the store's change marks the day added back (`-now`) over its removal on record. `clear` lists
 * days to empty in the same change (the day an edit moved the check-in to).
 */
export function setMeasurementsBack(entry, { clear = [] } = {}, now = Date.now()) {
  const days = new Set([entry.d, ...clear])
  write(state => {
    state.measurements = state.measurements.filter(e => !days.has(e.d))
    state.measurements.push({ ...clone(entry), t: now })
  })
  void syncNow()
}

/**
 * The Undo of an edit: `before` (the day as it was) goes back, and `saved` (what the edit wrote, on
 * its own day if the edit moved it) comes out. Only while `saved` is still its day's entry: a newer
 * one (another device's, merged in meanwhile) is left alone. Returns whether it went back.
 */
export function undoMeasurementEdit(before, saved) {
  if (!before?.d || !saved?.d) return false
  if (measurementOn(useStore.getState().S, saved.d)?.t !== saved.t) return false
  setMeasurementsBack(before, { clear: [saved.d] })
  return true
}

/** Switches a built-in field on or off. Its readings stay in the history either way. */
export function setBuiltinTracked(key, on) {
  write(state => {
    const set = new Set(state.measurementEnabled || [])
    if (on) set.add(key); else set.delete(key)
    state.measurementEnabled = [...set]
  })
}

/** Switches a custom field on or off. Its readings stay in the history either way. */
export function setCustomTracked(id, on) {
  write(state => {
    const item = state.customMeasurements.find(c => c.id === id)
    if (item) item.enabled = on
  })
}

/** Adds a custom field (on). `{ ok: false, reason: 'empty' | 'exists' }` when the name is blank or taken. */
export function addCustomField(name) {
  const clean = String(name ?? '').trim()
  if (!clean) return { ok: false, reason: 'empty' }
  const S = useStore.getState().S
  const lower = clean.toLowerCase()
  if ((S.customMeasurements || []).some(c => c.name.toLowerCase() === lower) ||
    MEASUREMENT_FIELDS.some(f => f.label.toLowerCase() === lower)) return { ok: false, reason: 'exists' }
  write(state => { state.customMeasurements.push({ id: uid(), name: clean.slice(0, 60), enabled: true }) })
  return { ok: true }
}
