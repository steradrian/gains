import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayISO } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { energyOf } from '../lib/nutrition/diary.js'
import { useDiaryTarget } from '../lib/nutrition/selection.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { useDiaryDay } from '../lib/nutrition/use-diary-day.js'
import { Card, EmptyState, Stat, StatTile, Tiles } from '../components/blocks.jsx'
import { Inline, Page } from '../components/layout.jsx'
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
  const { on, status, settings, totals, macros, left } = useDiaryDay(todayISO())
  const foods = useNutrition(s => s.foods)
  const { meal } = useDiaryTarget(settings)

  useEffect(() => {
    if (on) useNutrition.getState().loadFoods()
  }, [on])

  if (!on) {
    return <Page root title={t('Nutrition')}>
      <Card>
        <EmptyState icon="utensils" title={t('Nutrition lives in the web app')}>{t('Sign in on the web app to log food and see your day here.')}</EmptyState>
      </Card>
    </Page>
  }

  // One entry per page that exists. Saved meals, Recipes and Goals add theirs with their pages.
  const targets = [
    { path: '/food/foods', icon: 'apple', title: t('Foods'), sub: foods.status === 'ready' ? tn('{0} food', '{0} foods', foods.list.length) : t('Your own foods') },
  ]

  const leftIn = energyOf(Math.abs(left), settings)

  return <Page root title={t('Nutrition')}>
    <Card {...tappable(() => nav('/home'))}>
      {status === 'ready' ? <>
        <Stat value={leftIn.value.toLocaleString()} />
        <div className="small muted">{left >= 0 ? t('{0} left today', leftIn.unit) : t('{0} over today', leftIn.unit)}</div>
        <Inline gap={10} className="mt-6">
          {MACROS.map(m => {
            const eaten = Math.round(totals[m.id] || 0)
            const goal = macros[m.id]
            return <div key={m.id} className="small">
              <div className="muted">{m.label()}</div>
              <b>{goal != null ? t('{0} of {1} g', eaten, Math.round(goal)) : t('{0} g', eaten)}</b>
            </div>
          })}
        </Inline>
      </> : status === 'error'
        ? <div className="small muted">{t('Today’s diary did not load.')}</div>
        : <div className="small muted" role="status">{t('Loading…')}</div>}
    </Card>
    <YesterdayMealRow settings={settings} meal={meal} />
    <Tiles className="hub-tiles">
      {targets.map(x => <StatTile key={x.path} className="hub-tile" icon={x.icon} label={x.title} value={x.sub} onClick={() => nav(x.path)} />)}
    </Tiles>
  </Page>
}
