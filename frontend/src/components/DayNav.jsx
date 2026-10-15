import { useStore } from '../store/useStore.js'
import { todayISO, weekStartOf } from '../lib/format.js'
import { oneOf } from '../lib/ui-kit.js'
import { useDiarySelection, useDiaryTarget } from '../lib/nutrition/selection.js'
import { dayMark } from '../lib/training-day.js'
import { dayOverrideSheet } from '../sheets.jsx'
import { MonthBar, WeekStrip } from './date-nav.jsx'

// The month and the week over a tab root, on the one date every tab shares
// (lib/nutrition/selection.js; ux-redesign-tabs §4.4). Today and the days before it are picked;
// a day to come is never the date. future="plan" (Home, Training): tapping one opens "change this
// day" for it (the plan's sheet) and the date stays; future="off" (Nutrition): it is dimmed and
// cannot be tapped. The dots are the training calendar's.
export default function DayNav({ future = 'plan' }) {
  oneOf('DayNav', 'future', future, ['plan', 'off'])
  const S = useStore(s => s.S)
  const { date } = useDiaryTarget(null)
  const setDate = useDiarySelection(s => s.setDate)
  const today = todayISO()
  const onSelect = iso => { if (iso > today) dayOverrideSheet(iso); else setDate(iso) }
  return <>
    <MonthBar date={date} onPickDate={setDate} onToday={() => setDate(null)} />
    <WeekStrip date={date} onSelect={onSelect} marks={iso => dayMark(S, iso)} weekStart={weekStartOf(S)}
      maxDate={future === 'off' ? today : undefined} />
  </>
}
