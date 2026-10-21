// When nothing matches (boards Sh0None, Sh0NoExercise): what to say, and the ways on that apply.
// Pure: each action says what it is (`kind`), and components/search/open-result.js
// `runNoneAction` carries it out.
import { t } from '../i18n-core.js'
import { nearest } from './match.js'
import { exerciseRow, foodRow, stageSub } from './results.js'
import { searchTab } from './scopes.js'

/**
 * Whether the query reads as a search for an exercise that is not there (H0.9): scoped to Train or
 * to the exercises group, something typed, and no exercise among the results (the best match
 * included). Then Create comes first, before Did you mean, even while other groups have results.
 */
export function exerciseMiss({ query, tab, group, local }) {
  if (!query.trim() || !(searchTab(tab) === 'train' || group === 'exercises')) return false
  return !(local.groups.exercises || []).length && local.best?.group !== 'exercises'
}

/** The heading: { title, body }. `mode` 'exercise' (H0.9) or 'any' (H0.6). */
export function noneHeading(query, mode) {
  const q = query.trim()
  return mode === 'exercise'
    ? { title: t('No exercise called “{0}”', q), body: t('It isn’t in the library or your own exercises yet.') }
    : { title: t('Nothing matches “{0}”', q), body: t('Try another word, or make it yourself.') }
}

// The nearest name among your foods and the exercises (or the exercises alone), as its row.
function didYouMean(q, data, exercisesOnly) {
  const foods = exercisesOnly || !data.nutrition ? [] : (data.foods || []).filter(f => f?.name)
  const names = new Map()
  for (const f of foods) if (!names.has(f.name)) names.set(f.name, () => foodRow(f))
  for (const ex of data.exercises || []) {
    const name = data.nameOf(ex.id)
    if (name && !names.has(name)) names.set(name, () => exerciseRow(ex, data.S, []))
  }
  const near = nearest(q, [...names.keys()])
  return near ? { name: near, row: names.get(near)() } : null
}

/**
 * The ways on, only those that apply, in the board's order:
 *   any       Did you mean, Create food (nutrition on), Create exercise, Search Open Food Facts
 *             (when it would be asked only on a tap: `onlineStatus` 'tap')
 *   exercise  Create, then Did you mean (an exercise)
 * Each: { key, kind: 'near' | 'create-food' | 'create-exercise' | 'online', glyph, title, sub,
 * name (what it creates or searches for, or the name meant), row (Did you mean's) }.
 */
export function noneActions({ query, data, mode = 'any', onlineStatus }) {
  const q = query.trim()
  if (!q) return []
  const near = didYouMean(q, data, mode === 'exercise')
  const nearAction = near && { key: 'near', kind: 'near', glyph: 'magnifier', title: t('Did you mean “{0}”?', near.name), sub: stageSub(near.row), name: near.name, row: near.row }
  if (mode === 'exercise') {
    return [
      { key: 'create-exercise', kind: 'create-exercise', glyph: 'plus', title: t('Create “{0}”', q), sub: t('Opens New exercise with the name filled in'), name: q },
      nearAction,
    ].filter(Boolean)
  }
  return [
    nearAction,
    data.nutrition && { key: 'create-food', kind: 'create-food', glyph: 'apple', title: t('Create food “{0}”', q), sub: t('Opens the food editor with this name'), name: q },
    { key: 'create-exercise', kind: 'create-exercise', glyph: 'dumbbell', title: t('Create exercise “{0}”', q), sub: t('Opens New exercise with this name'), name: q },
    onlineStatus === 'tap' && { key: 'online', kind: 'online', glyph: 'globe', title: t('Search Open Food Facts'), sub: t('For “{0}”, online', q), name: q },
  ].filter(Boolean)
}
