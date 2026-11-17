import { t } from '../../lib/i18n.js'
import { nutrientLabel } from '../../lib/nutrition/foods.js'

// The saved meal editor's macro lines and "share of a day's targets" (board Ea5Meal). A target is
// only said when the day's goal sets one: no goal, no "of 150 g" and no share, never a stand-in.

const MACROS = ['proteins', 'carbohydrates', 'fat']

/** [{ id, label, grams, target, percent }] for protein, carbs and fat. `total` is the meal's
 *  nutrients, `targets` food-target.js dayTargetsOf's (or null while it loads: no targets). */
export function macroRows(total, targets) {
  return MACROS.map(id => {
    const grams = Math.round(Number(total?.[id]) || 0)
    const goal = targets?.ready ? targets.macro(id) : null
    const target = Number(goal) > 0 ? Math.round(goal) : null
    return { id, label: nutrientLabel(id), grams, target, percent: target ? Math.round((Number(total?.[id]) || 0) / target * 100) : null }
  })
}

const PART = {
  proteins: percent => t('protein {0}%', percent),
  carbohydrates: percent => t('carbs {0}%', percent),
  fat: percent => t('fat {0}%', percent),
}

/** "The share of a day’s targets: protein 14%, carbs 34%, fat 14%." with the macros that have a
 *  target; null when none has. */
export function shareLine(rows) {
  const parts = rows.filter(r => r.percent != null).map(r => PART[r.id](r.percent))
  return parts.length ? t('The share of a day’s targets: {0}.', parts.join(', ')) : null
}
