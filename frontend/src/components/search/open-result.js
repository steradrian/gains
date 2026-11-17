// Where a search result goes (fitness-eval ux-search.md §4): search finds things, and every result
// opens the place where you act on it. A sheet opens over the overlay (back closes it, back on the
// overlay); a route opens on top of it as a search visit (lib/search/session.js), and back
// returns to the overlay. Pure in what it decides (`targetOf`), so the table is testable. And the
// search's other taps: a Go to chip, a feature's Turn on, the ways on when nothing matches.
import { t } from '../../lib/i18n.js'
import { dayPath } from '../../lib/day-route.js'
import { todayISO } from '../../lib/format.js'
import { TAB_ROOT } from '../../lib/tab-route.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { NEW_FOOD_PATH, foodEditorPath } from '../../lib/nutrition/editor-routes.js'
import { useNutrition } from '../../lib/nutrition/store.js'
import { setFastingEnabled } from '../../lib/nutrition/use-fasting.js'
import { writeErrorText } from '../../lib/nutrition/log-feedback.js'
import { setGroup, setQuery, visit } from '../../lib/search/session.js'
import { addRecent, noteOpened } from '../../lib/search/recents.js'
import { bwSheet, customExSheet, exerciseDetailSheet, workoutDetailSheet } from '../../sheets.jsx'
import { foodDetailSheet } from '../FoodDetailSheet.jsx'
import { mealDetailSheet } from '../MealDetailSheet.jsx'
import { manageMeasurementsSheet } from '../../views/me/body/measure-drawers.jsx'
import { settingsPath } from '../../views/settings/paths.js'

const settingsRoute = at => ({ kind: 'route', path: settingsPath(at.page), state: { find: at.find } })

/** What a result opens: { kind: 'route', path, state?, date? } | { kind: 'sheet', open() }. */
export function targetOf(r) {
  const settings = () => useNutrition.getState().settings.data
  switch (r.type) {
    case 'page': return r.off ? settingsRoute(r.off) : { kind: 'route', path: r.path }
    // A switched-off feature's card, opened as a whole: the page with its switch.
    case 'feature': return settingsRoute(r.off)
    case 'setting': {
      const e = r.entry
      if (e.isPage && e.sheet) return { kind: 'sheet', open: manageMeasurementsSheet }
      if (e.isPage) return { kind: 'route', path: e.to || settingsPath(e.page) }
      return { kind: 'route', path: settingsPath(e.page), state: e.via ? { find: e.title, via: e.via } : { find: e.title } }
    }
    case 'exercise': return { kind: 'sheet', open: () => exerciseDetailSheet(r.ex, { progress: true }) }
    case 'routine': return { kind: 'route', path: '/train/routines/' + encodeURIComponent(r.id) }
    case 'workout': return { kind: 'sheet', open: () => workoutDetailSheet(r.workout) }
    case 'food': return { kind: 'sheet', open: () => foodDetailSheet({ food: r.food, settings: settings(), onEdit: f => visit(foodEditorPath(f.id)) }) }
    case 'meal':
    case 'recipe': return { kind: 'sheet', open: () => mealDetailSheet({ id: r.id, recipe: r.type === 'recipe' }) }
    case 'online': return {
      kind: 'sheet',
      open: () => foodDetailSheet({
        food: r.food, settings: settings(),
        onSave: async f => { await useNutrition.getState().saveFood(f); useUI.getState().toast(t('Saved to your foods')) },
      }),
    }
    // A past day opens its Day page under Eat (PR07 D1), the entry to find in its state; today
    // is Today (Eat's root holds no diary any more).
    case 'day': return r.date < todayISO()
      ? { kind: 'route', path: dayPath(r.date, 'food'), ...(r.uuid ? { state: { find: r.uuid } } : {}) }
      : { kind: 'route', path: TAB_ROOT.home }
    // Suggestions only: today's weigh-in, and the plan where a missed day is moved.
    case 'weighin': return { kind: 'sheet', open: () => bwSheet({ date: r.date }) }
    case 'missed': return { kind: 'route', path: r.path }
    default: return { kind: 'none' }
  }
}

// Kept out of Recent: a result that is not a thing kept (an online food until saved, a feature
// card) or that only makes sense right now (a suggestion's weigh-in, a missed day).
const NOT_RECENT = new Set(['online', 'feature', 'weighin', 'missed'])

/** Opens a result, and remembers it (Recent, how often it is opened). `query` is what was typed. */
export function openResult(r, { query = '' } = {}) {
  const target = targetOf(r)
  if (target.kind === 'none') return
  if (!NOT_RECENT.has(r.type)) addRecent({ kind: 'result', type: r.type, id: r.id, label: r.title, query })
  noteOpened(r.key)
  if (target.kind === 'sheet') { target.open(); return }
  visit(target.path, { date: target.date, state: target.state })
}

/** A Go to chip (lib/search/start.js shortcutsFor): its page, or the search scoped to its group. */
export function openShortcut(chip) {
  if (chip.target.kind === 'scope') { setGroup(chip.target.group); return }
  visit(chip.target.path)
}

/** A feature card's Features (or whichever page holds its switch), at the switch. */
export function openFeaturePage(r) {
  const target = settingsRoute(r.off)
  visit(target.path, { state: target.state })
}

/** A feature card's Turn on: flips the feature where it lives. Resolves true once it is on; a
 *  failure is said in a toast and resolves false, the card staying as it was. */
export async function turnOnFeature(r) {
  try {
    if (r.id === 'fasting') await setFastingEnabled(true)
    else if (r.id === 'checkIn') useStore.getState().update(s => { s.checkIn = true })
    else return false
    return true
  } catch (e) {
    useUI.getState().toast(writeErrorText(e))
    return false
  }
}

/**
 * One of the ways on when nothing matches (lib/search/none.js `noneActions`): Did you mean searches
 * for the name meant; Create food opens the food editor with the name; Create exercise opens the
 * custom-exercise sheet with it (Train's New exercise page, T6.4, takes its place once it is
 * built); Search Open Food Facts asks it (`askOnline`, use-online-results.js `ask`).
 */
export function runNoneAction(action, { askOnline } = {}) {
  switch (action.kind) {
    case 'near': setQuery(action.name); return
    case 'create-food': visit(NEW_FOOD_PATH, { state: { prefill: { name: action.name } } }); return
    case 'create-exercise': customExSheet(null, null, action.name); return
    case 'online': askOnline?.(); return
    default:
  }
}
