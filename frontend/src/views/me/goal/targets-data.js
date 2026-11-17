// What the Daily targets drawer (board Me3Targets) edits and says, worked out from NutriTrace's
// settings. No UI: the drawer draws it. The rules (draft, writes, notes) are lib/nutrition/goals.js;
// this only turns them into text fields in the person's units and back.
import { t } from '../../../lib/i18n.js'
import { energyOf } from '../../../lib/nutrition/diary.js'
import {
  DENSITY, MACROS, allDaysEdit, draftOf, energyFromUnit, goalNotes, hasWearable, macroGrams, waterFromUnit, waterToUnit, waterUnitOf,
} from '../../../lib/nutrition/goals.js'

export const FIELDS = ['kcal', ...MACROS, 'water']
export const LOW_KCAL = 1200
const WATER_SUFFIX = { ml: 'ml', oz: 'fl oz', L: 'L', G: 'G' }

export const modeNote = mode => {
  if (mode === 'adaptive') return t('Learns your real daily burn from 35 days of weight and diary, then sets the target from it. Until there is enough data it uses your fixed target.')
  if (mode === 'dynamic') return t('Uses yesterday’s total burn from your wearable. Falls back to your fixed target when there is no data.')
  return t('The same calorie target every day.')
}

export const modeOptions = () => [
  { value: 'fixed', label: t('Fixed') },
  { value: 'adaptive', label: t('Adaptive') },
  { value: 'dynamic', label: t('Dynamic') },
]

export const macroLabel = id => (id === 'proteins' ? t('Protein') : id === 'carbohydrates' ? t('Carbs') : t('Fat'))

/** A typed number: positive, a comma allowed; anything else is null. */
export function parseField(text) {
  const s = String(text ?? '').trim()
  if (s === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * The drawer's starting point from the settings: the draft the writes are diffed from, the field
 * texts (energy and water in the person's units, macros in grams) and what each field's unit is.
 * A calorie target or macro that differs by weekday has an empty field and is shown read-only.
 */
export function initialOf(settings) {
  const draft = draftOf(settings)
  const waterUnit = waterUnitOf(settings)
  const grams = id => macroGrams(draft.macros[id], id, draft.kcal ?? 0)
  const fields = {
    kcal: draft.kcal == null ? '' : String(energyOf(draft.kcal, settings).value),
    ...Object.fromEntries(MACROS.map(id => [id, grams(id) == null ? '' : String(grams(id))])),
    water: draft.waterMl > 0 ? String(waterToUnit(draft.waterMl, waterUnit)) : '',
  }
  return {
    settings,
    draft,
    fields,
    wearable: hasWearable(settings),
    units: { kcal: energyOf(0, settings).unit, water: WATER_SUFFIX[waterUnit] },
    weekday: { kcal: draft.kcalPerWeekday, ...Object.fromEntries(MACROS.map(id => [id, draft.macros[id].perWeekday])) },
  }
}

/** Whether the person changed anything: a field's text or the mode. */
export const isDirty = (initial, fields, mode) =>
  mode !== initial.draft.mode || FIELDS.some(k => fields[k] !== initial.fields[k])

/**
 * The draft `writesFor` takes: the initial one with what was typed laid over it. A field left as it
 * was stays as stored (a macro kept as a percent stays a percent, a kJ target keeps its kcal); a
 * macro that was edited becomes grams. A cleared macro is removed; a cleared water goal is left.
 */
export function draftFor(initial, fields, mode) {
  const { settings } = initial
  const draft = { ...initial.draft, mode }
  const edited = k => fields[k] !== initial.fields[k]
  if (edited('kcal') && !initial.weekday.kcal) {
    const n = parseField(fields.kcal)
    const all = allDaysEdit(n == null ? null : energyFromUnit(n, settings))
    draft.kcal = all.value
    draft.kcalDays = all.days
  }
  draft.macros = { ...draft.macros }
  for (const id of MACROS) {
    if (!edited(id) || initial.weekday[id]) continue
    draft.macros[id] = { ...draft.macros[id], ...allDaysEdit(parseField(fields[id])), percent: false }
  }
  if (edited('water')) {
    const n = parseField(fields.water)
    if (n != null) draft.waterMl = waterFromUnit(n, waterUnitOf(settings))
  }
  return draft
}

/** Whether Save can go: a calorie target is needed unless it is the weekday one. */
export const canSave = (initial, fields) => initial.weekday.kcal || parseField(fields.kcal) != null

/** `{ code: 'low'|'high'|'mismatch', kcal, sum?, carbsG? }` for the draft; `carbsG` is the fix for a mismatch. */
export function warningsOf(initial, fields, mode) {
  const draft = draftFor(initial, fields, mode)
  const kcal = draft.kcal
  if (!(kcal > 0)) return []
  const anyWeekday = MACROS.some(id => initial.weekday[id])
  const grams = Object.fromEntries(MACROS.map(id => [id, macroGrams(draft.macros[id], id, kcal)]))
  return goalNotes(kcal, grams)
    .filter(n => n.code !== 'mismatch' || !anyWeekday)
    .map(n => {
      if (n.code !== 'mismatch' || initial.weekday.carbohydrates) return n
      const rest = kcal - (grams.proteins || 0) * DENSITY.proteins - (grams.fat || 0) * DENSITY.fat
      const carbsG = Math.round(rest / DENSITY.carbohydrates)
      return carbsG > 0 && carbsG !== grams.carbohydrates ? { ...n, carbsG } : n
    })
}

/** The words of a warning. `energy(kcal)` is the person's unit ("2,100 kcal"). */
export function warningText(n, energy) {
  if (n.code === 'low') return t('Most guidelines suggest at least {0}.', energy(LOW_KCAL))
  if (n.code === 'high') return t('The calorie target is very high ({0}). Check that this is intended.', energy(n.kcal))
  return t('The macros add up to {0}, the calorie target is {1}.', energy(n.sum), energy(n.kcal))
}

export const fixCarbsLabel = carbsG => t('Set carbs to {0} g', carbsG)
