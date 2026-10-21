import StatTiles from '../../ds/StatTiles.jsx'
import { fmtDur } from '../../lib/format.js'
import { t, tn } from '../../lib/i18n.js'
import { lengthOf, longestFast } from '../../lib/nutrition/fasting.js'
import { dateText } from './fast-format.js'

const HOUR = 3600 * 1000

// Average, streak and longest (board Ea6Fasting). `stats` is fastingStats(); the average is over
// finished fasts only, and the streak is the one fastingStats defines (days a fast reached its
// goal, counting back from today).
export default function FastInsightTiles({ stats, history }) {
  const longest = longestFast(history)
  return <StatTiles tone="stage" items={[
    { key: 'avg', label: t('Average fast'), value: fmtDur(stats.avgHours * HOUR) },
    { key: 'streak', label: t('Streak'), value: tn('{0} day', '{0} days', stats.currentStreak), sub: t('on goal') },
    { key: 'longest', label: t('Longest fast'), value: longest ? fmtDur(lengthOf(longest)) : '', sub: longest ? dateText(Date.parse(longest.end_at)) : undefined },
  ]} />
}
