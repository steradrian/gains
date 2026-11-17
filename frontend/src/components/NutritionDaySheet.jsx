import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { mealItems, totalsOf } from '../lib/nutrition/diary.js'
import { loadErrorText } from '../lib/nutrition/log-feedback.js'
import { mealLabels } from '../lib/nutrition/meal-name.js'
import { useDiarySelection } from '../lib/nutrition/selection.js'
import { useDiaryDay } from '../lib/nutrition/use-diary-day.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import { drawerFlow, useUI } from '../store/useUI.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import SegmentedControl from '../ds/SegmentedControl.jsx'
import { foodPickerSheet } from './FoodPickerSheet.jsx'
import Icon from './Icon.jsx'
import { Loading } from './Loader.jsx'

// The tabs, in the order of Today's rings (views/today/use-today.js foodRings), so a ring opens its own.
const TABS = [
  { key: 'calories', name: () => t('Calories') },
  { key: 'proteins', name: () => t('Protein') },
  { key: 'carbohydrates', name: () => t('Carbs') },
  { key: 'fat', name: () => t('Fat') },
]

const grams = g => fmtNum(Math.round(Number(g) || 0))

/** One tab of the drawer for a day (useDiaryDay's): the amount eaten against its target, a bar
 *  segment per logged meal (of the target, or of what was eaten when that is more or there is no
 *  target), and the meals, each with its share of what was eaten or nothing yet. */
export function nutritionTab(day, key, units) {
  const energy = key === 'calories'
  const amount = x => (energy ? units.energyValue(x) : grams(x))
  const withUnit = x => (energy ? units.energy(x) : grams(x) + ' g')
  const eaten = Number(day.totals[key]) || 0
  const target = energy ? day.target.target : day.macros[key]
  const hasTarget = target > 0
  const scale = Math.max(hasTarget ? target : 0, eaten)
  const meals = mealLabels(day.settings).map((name, slot, all) => {
    const items = mealItems(day.entry, slot, all.length)
    const had = Number(totalsOf(items)[key]) || 0
    return {
      slot, name, logged: items.length > 0, had,
      sub: items.length ? withUnit(had) : t('Nothing yet'),
      share: items.length ? (eaten > 0 ? Math.round(had / eaten * 100) + '%' : '0%') : null,
    }
  })
  const left = hasTarget ? Math.round(target - eaten) : null
  return {
    key,
    big: amount(eaten),
    of: hasTarget ? t('of {0} eaten', withUnit(target)) : t('{0} eaten', energy ? units.energyUnit : 'g'),
    left: left == null ? null : left < 0 ? t('{0} over', amount(-left)) : t('{0} left', amount(left)),
    over: left != null && left < 0,
    bar: meals.filter(m => m.had > 0).map(m => ({ slot: m.slot, width: scale > 0 ? m.had / scale * 100 : 0 })),
    meals,
  }
}

/** The calories tab's last row: energy burned today, and whether it raised the target. */
export function burnedOf(day, units) {
  const burned = day.activitySum?.effective > 0 ? day.activitySum.effective : 0
  if (!burned) return null
  return { title: t('Burned {0}', units.energy(burned)), sub: day.target.added > 0 ? t('Added to your target') : t('Not added to your target') }
}

// Nutrition for a day (board T13Nutrition): Calories, Protein, Carbs and Fat, each the day's total
// against its target and the meals that make it up. A meal with nothing yet has a + that logs to it.
function NutritionDay({ date, tab: first }) {
  const day = useDiaryDay(date)
  const units = useUnits()
  const [tab, setTab] = useState(TABS[first]?.key || TABS[0].key)
  // Log food opens as a step of this drawer, so back returns here; logging or leaving to a page
  // ends the flow and closes both (store/useUI.js drawerFlow).
  const addTo = slot => {
    const sel = useDiarySelection.getState()
    sel.setDate(date)
    sel.setMeal(slot)
    drawerFlow(() => foodPickerSheet())
  }
  const ready = day.status === 'ready'
  const view = ready ? nutritionTab(day, tab, units) : null
  const burned = ready && tab === 'calories' ? burnedOf(day, units) : null
  const title = date === todayISO() ? t('Nutrition today') : t('Nutrition')
  return (
    <BottomSheet type="full" title={title}
      head={<SegmentedControl options={TABS.map(x => ({ value: x.key, label: x.name() }))} value={tab} onChange={setTab} label={t('Nutrition')} />}>
      {day.status === 'error'
        ? <>
          <p className="g-nd-note" role="alert">{loadErrorText(day.error)}</p>
          <Button variant="secondary" onClick={day.reload}>{t('Try again')}</Button>
        </>
        : !view
          ? <Loading />
          : <div className={'g-nd g-nd-' + view.key}>
            <div className="g-nd-total">
              <span><span className="g-nd-num">{view.big}</span><span className="g-nd-of">{view.of}</span></span>
              {view.left && <span className={'g-nd-left' + (view.over ? ' g-nd-over' : '')}>{view.left}</span>}
            </div>
            <div className="g-nd-bar" aria-hidden="true">
              {view.bar.map(b => <span key={b.slot} style={{ width: b.width + '%' }} />)}
            </div>
            {view.meals.map(m => (
              <div key={m.slot} className="g-nd-row">
                <span className={'g-nd-dot' + (m.had > 0 ? ' g-nd-dot-on' : '')} aria-hidden="true" />
                <span className="g-nd-text"><span className="g-nd-name">{m.name}</span><span className="g-nd-sub">{m.sub}</span></span>
                {m.logged
                  ? <span className="g-nd-pct">{m.share}</span>
                  : <button type="button" className="g-nd-add" aria-label={t('Add {0}', m.name)} onClick={() => addTo(m.slot)}><Icon name="plus" className="g-icon" /></button>}
              </div>
            ))}
            {burned && (
              <div className="g-nd-row">
                <span className="g-nd-lead" aria-hidden="true"><Icon name="flame" className="g-icon" /></span>
                <span className="g-nd-text"><span className="g-nd-name">{burned.title}</span><span className="g-nd-sub">{burned.sub}</span></span>
              </div>
            )}
          </div>}
    </BottomSheet>
  )
}

/** Opens the Nutrition drawer for `date` (today by default) on tab `tab` (0 Calories, 1 Protein,
 *  2 Carbs, 3 Fat: the index of Today's ring). */
export function nutritionDaySheet({ date = todayISO(), tab = 0 } = {}) {
  useUI.getState().openSheet(() => <NutritionDay date={date} tab={tab} />, { variant: 'ds' })
}
