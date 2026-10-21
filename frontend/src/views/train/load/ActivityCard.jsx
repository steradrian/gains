import { useMemo } from 'react'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { normalizeMetric } from '../../../lib/activity-heatmap.js'
import { workoutDay } from '../../../lib/history.js'
import Heatmap from '../../../ds/Heatmap.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import { openDay, workoutDetailSheet } from '../../../sheets.jsx'
import { activityOf } from './use-training-load.js'

// A day on the heatmap: one workout opens it (T8.1); several, or a day with only a note, open the day.
export function tapDay(S, iso) {
  const on = (S.workouts || []).filter(w => workoutDay(w) === iso)
  if (on.length === 1) workoutDetailSheet(on[0])
  else openDay(iso)
}

const setMetric = metric => useStore.getState().update(s => { s.heatmapMetric = metric })

/**
 * Activity (T9.0, T9.1): the last 12 months by time or by volume, the choice kept on the profile
 * (S.heatmapMetric). The day the page is drawn on is `today`, so the grid moves on at midnight.
 */
export default function ActivityCard({ S, today }) {
  const metric = normalizeMetric(S.heatmapMetric)
  const grid = useMemo(() => activityOf(S, metric, new Date(today + 'T12:00:00')), [S.workouts, S.dayNotes, S.weekStart, S.unit, metric, today])
  return (
    <section className="g-load-sec" aria-label={t('Activity')}>
      <StageSection title={t('Activity')} action={t('Last 12 months')} />
      <StageSegmented label={t('Shade by')} value={metric} onChange={setMetric}
        options={[{ value: 'time', label: t('Time') }, { value: 'vol', label: t('Volume') }]} />
      <Heatmap tone="stage" levels={5} byWeek values={grid.values} days={grid.days} months={grid.months}
        label={t('Activity, last 12 months')} onDay={iso => tapDay(S, iso)}
        legend={{ less: t(metric === 'vol' ? 'Less volume' : 'Less time'), more: t(metric === 'vol' ? 'More volume' : 'More time') }} />
    </section>
  )
}
