import { useEffect } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { todayISO } from '../lib/format.js'
import { loadErrorText } from '../lib/nutrition/log-feedback.js'
import { useUnits } from '../lib/nutrition/use-units.js'
import { dayHasLog, hasLogged, markLogged } from '../lib/nutrition/first-log.js'
import { HeroStatus } from './tab-kit.jsx'
import { useTrainingHero } from './TrainingHero.jsx'

const EMPTY = '–'
const grams = n => Math.round(n || 0).toLocaleString(dateLocale())
const MACROS = [
  { id: 'proteins', cls: 'p', label: () => t('Protein') },
  { id: 'carbohydrates', cls: 'c', label: () => t('Carbs') },
  { id: 'fat', cls: 'f', label: () => t('Fat') },
]

// Home's hero for the selected day: its training status with ⋯ (a different workout, change this
// day; TrainingHero.jsx, which Training shows alone), then, with nutrition, `kcal left (eaten) |
// water` (eaten against the target on a past day), the compact protein, carbs and fat line, and
// on first run the line that says the numbers count from the first log. `day` is useDiaryDay's.
export default function HomeHero({ date, day }) {
  const units = useUnits()
  const today = todayISO()
  const training = useTrainingHero(date)
  const logged = day.status === 'ready' && dayHasLog(day.entry)
  useEffect(() => { if (logged) markLogged() }, [logged])

  if (!day.on) return <HeroStatus {...training} />

  const ready = day.status === 'ready'
  const value = v => (ready ? v : EMPTY)
  const water = units.waterParts(day.water.total)
  const energy = date === today
    ? { label: day.left < 0 ? t('{0} over', units.energyUnit) : t('{0} left', units.energyUnit), value: value(units.energyValue(Math.abs(day.left))), sub: ready ? t('{0} eaten', units.energy(day.totals.calories)) : null }
    : { label: t('Eaten'), value: value(units.energyValue(day.totals.calories)), unit: ready ? units.energyUnit : undefined, sub: ready ? t('of {0}', units.energy(day.target.target)) : null }
  const metrics = [
    energy,
    { label: t('Water'), value: day.dayReady ? water.value : EMPTY, unit: day.dayReady ? water.unit : undefined, sub: day.dayReady ? t('of {0}', units.water(day.water.goal)) : null },
  ]
  return <HeroStatus {...training} metrics={metrics} status={day.status === 'error' ? 'error' : 'ready'} onRetry={day.reload}>
    {day.status === 'error' && <p className="hero-c" role="alert">{loadErrorText(day.error)}</p>}
    {ready && <p className="hero-macros">
      {MACROS.map(m => <span key={m.id}>
        <i className={'mdot ' + m.cls} aria-hidden="true" /><span className="sr-only">{m.label()} </span>
        {grams(day.totals[m.id])}{day.macros[m.id] != null && '/' + grams(day.macros[m.id])} g
      </span>)}
    </p>}
    {ready && date === today && !logged && !hasLogged() && <p className="hero-c">{t('Counts from your first log')}</p>}
  </HeroStatus>
}
