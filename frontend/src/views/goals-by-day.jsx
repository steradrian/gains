import { useState } from 'react'
import { dateLocale, t } from '../lib/i18n.js'
import { energyOf } from '../lib/nutrition/diary.js'
import { MACROS, energyFromUnit, oneDayEdit } from '../lib/nutrition/goals.js'
import { Row, Section, Segmented, Stepper } from '../components/ui.jsx'
import { macroLabel } from './me/goal/targets-data.js'

// Goals › Targets by day: a calorie target and the three macros for each day of the week. The
// fields above set every day at once; this edits the one day picked here and leaves the rest.
// Day numbers are Date#getDay (0 = Sunday), the way the goals setting stores them.

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]
// 2024-01-07 was a Sunday: day n of the week is 7 + n.
const dayName = (dow, weekday) => new Intl.DateTimeFormat(dateLocale(), { weekday, timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + dow)))

export default function GoalsByDay({ draft, patch, settings, today }) {
  const [picked, setPicked] = useState(today)
  const unit = energyOf(0, settings).unit
  const fixed = draft.mode === 'fixed'
  const kcalDay = draft.kcalDays[picked]

  const setKcal = v => patch(d => {
    const e = oneDayEdit(d.kcalDays, picked, energyFromUnit(v, settings))
    return { kcal: e.value, kcalDays: e.days, kcalPerWeekday: e.perWeekday }
  })
  const setMacro = (id, v) => patch(d => ({ macros: { ...d.macros, [id]: { ...d.macros[id], ...oneDayEdit(d.macros[id].days, picked, v) } } }))

  return <Section title={t('Targets by day')} footer={t('The fields above set every day at once. Pick a day to change only that day.')}>
    <Row>
      <Segmented className="seg-inline" ariaLabel={t('Day of the week')} value={picked} onChange={setPicked}
        options={MONDAY_FIRST.map(dow => ({ value: dow, label: dayName(dow, 'short'), ariaLabel: dayName(dow, 'long') }))} />
    </Row>
    <Row icon="target" iconTint="var(--red)" title={fixed ? t('Daily target') : t('Fallback target')}>
      <Stepper value={kcalDay == null ? null : energyOf(kcalDay, settings).value} step={unit === 'kJ' ? 100 : 50}
        min={kcalDay == null ? 0 : unit === 'kJ' ? 5 : 1} decimal={false} unit={unit} ariaLabel={`${t('Daily target')} ${dayName(picked, 'long')}`}
        onChange={setKcal} />
    </Row>
    {MACROS.map(id => {
      const m = draft.macros[id]
      return <Row key={id} title={macroLabel(id)}>
        <Stepper value={m.days[picked]} step={m.percent ? 1 : 5} min={m.days[picked] == null ? 0 : m.percent ? 0.01 : 1} max={m.percent ? 100 : Infinity}
          decimal={m.percent} unit={m.percent ? '%' : 'g'} ariaLabel={`${macroLabel(id)} ${dayName(picked, 'long')}`}
          onChange={v => setMacro(id, v)} />
      </Row>
    })}
  </Section>
}
