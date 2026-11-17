import BarChart from '../../ds/BarChart.jsx'
import StageNote from '../../ds/StageNote.jsx'
import { fmtDur } from '../../lib/format.js'
import { t, dateLocale } from '../../lib/i18n.js'
import { dayInitial } from '../../lib/nutrition/fasting.js'

const HOUR = 3600 * 1000

// Fasting hours on each of the last 14 days (board Ea6Fasting) with the goal as the dashed line.
// `days` is recentDays(): oldest first, today last and lit.
export default function FastDaysChart({ days, goalHours }) {
  const spokenDay = day => new Date(day + 'T12:00:00').toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' })
  return <>
    <BarChart tone="stage" values={days.map(d => d.hours)} labels={days.map(d => dayInitial(d.day, dateLocale()))}
      highlight={days.length - 1} target={goalHours} label={t('Fasting hours, last 14 days')}
      barLabels={days.map(d => t('{0}: {1}', spokenDay(d.day), d.hours > 0 ? fmtDur(d.hours * HOUR) : t('No fast')))} />
    <StageNote>{t('The dashed line is your {0} h goal. A day without a fast stays empty.', goalHours)}</StageNote>
  </>
}
