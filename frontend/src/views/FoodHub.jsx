import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayISO } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { energyOf } from '../lib/nutrition/diary.js'
import { useDiaryTarget } from '../lib/nutrition/selection.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDaySummary } from '../lib/nutrition/use-day-summary.js'
import Icon from '../components/Icon.jsx'
import RootHeader from '../components/RootHeader.jsx'
import YesterdayMealRow from '../components/YesterdayMealRow.jsx'

const MACROS = [
  { id: 'proteins', label: () => t('Protein') },
  { id: 'carbohydrates', label: () => t('Carbs') },
  { id: 'fat', label: () => t('Fat') },
]

// The Nutrition tab's root: today in one card (it opens the diary on Home), yesterday's meal to
// log again, and the places nutrition lives. A place gets a tile when its page exists.
export default function FoodHub() {
  const nav = useNavigate()
  const today = todayISO()
  const { on, status, settings, totals, target, macros } = useDaySummary(today)
  const foods = useNutrition(s => s.foods)
  const { meal } = useDiaryTarget(settings)

  useEffect(() => {
    if (on) useNutrition.getState().loadFoods()
  }, [on])

  if (!on) {
    return <div>
      <RootHeader title={t('Nutrition')} />
      <div className="card"><div className="empty">
        <div className="ico"><Icon name="utensils" /></div>
        <strong>{t('Nutrition lives in the web app')}</strong>
        <div>{t('Sign in on the web app to log food and see your day here.')}</div>
      </div></div>
    </div>
  }

  // One entry per page that exists. Saved meals, Recipes and Goals add theirs with their pages.
  const targets = [
    { path: '/food/foods', icon: 'apple', title: t('Foods'), sub: foods.status === 'ready' ? tn('{0} food', '{0} foods', foods.list.length) : t('Your own foods') },
  ]

  const left = target.target - (totals.calories || 0)
  const leftIn = energyOf(Math.abs(left), settings)

  return <div>
    <RootHeader title={t('Nutrition')} />
    <div className="card" role="button" {...tappable(() => nav('/home'))}>
      {status === 'ready' ? <>
        <div className="big">{leftIn.value.toLocaleString()}</div>
        <div className="small muted">{left >= 0 ? t('{0} left today', leftIn.unit) : t('{0} over today', leftIn.unit)}</div>
        <div className="row hub-macros">
          {MACROS.map(m => {
            const eaten = Math.round(totals[m.id] || 0)
            const goal = macros[m.id]
            return <div key={m.id} className="small">
              <div className="muted">{m.label()}</div>
              <b>{goal != null ? t('{0} of {1} g', eaten, Math.round(goal)) : t('{0} g', eaten)}</b>
            </div>
          })}
        </div>
      </> : status === 'error'
        ? <div className="small muted">{t('Today’s diary did not load.')}</div>
        : <div className="small muted" role="status">{t('Loading…')}</div>}
    </div>
    <YesterdayMealRow settings={settings} meal={meal} />
    <div className="tiles hub-tiles">
      {targets.map(x => (
        <div key={x.path} className="tile tappable hub-tile" role="button" {...tappable(() => nav(x.path))}>
          <Icon name={x.icon} className="hub-tile-i" />
          <div className="hub-tile-t">{x.title}</div>
          <div className="hub-tile-s">{x.sub}</div>
        </div>
      ))}
    </div>
  </div>
}
