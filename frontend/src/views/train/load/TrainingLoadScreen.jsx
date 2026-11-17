import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { hasEffort, hasEstimableEffort } from '../../../lib/effort.js'
import StagePage from '../../../ds/StagePage.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import { useTodayDate } from '../../today/use-today.js'
import ActivityCard from './ActivityCard.jsx'
import LoadBalance from './LoadBalance.jsx'
import LoadEffort from './LoadEffort.jsx'
import LoadFatigue from './LoadFatigue.jsx'
import LoadStrength from './LoadStrength.jsx'
import { loadSub, tabOf, toSchedule, useNow, viewOf } from './use-training-load.js'

/**
 * T9.0 Training load (/progress/load; the board's /train/trends): the year's activity, then
 * Balance, Fatigue and Strength, and Effort once there is effort to read (owner question 4). A
 * muscle anywhere opens its page (T9.6).
 *
 * `?view=` opens a segment (activity and muscles open Balance) and a segment change rewrites it in
 * place (replace), so back leaves the page. The Plan segment moved to the Plan page: `?view=plan`
 * and the old `?focus=weekly-volume` are replaced by /train/schedule.
 */
export default function TrainingLoadScreen() {
  const nav = useNavigate()
  const { search } = useLocation()
  const S = useStore(s => s.S)
  const today = useTodayDate()
  const now = useNow()
  const effort = hasEffort(S) || hasEstimableEffort(S)
  const moved = toSchedule(search)
  const [tab, setTab] = useState(() => tabOf(new URLSearchParams(search).get('view'), effort))
  useEffect(() => { if (moved) nav('/train/schedule', { replace: true }) }, [moved])
  if (moved) return null

  const tabs = [
    { value: 'balance', label: t('Balance') },
    { value: 'fatigue', label: t('Fatigue') },
    { value: 'strength', label: t('Strength') },
  ]
  if (effort) tabs.push({ value: 'effort', label: t('Effort (short)') })
  const shown = tabs.some(o => o.value === tab) ? tab : 'balance'
  const go = next => {
    setTab(next)
    const q = new URLSearchParams(search)
    q.set('view', viewOf(next))
    nav('/progress/load?' + q, { replace: true })
  }
  const openMuscle = slug => nav('/progress/load/muscle/' + slug)
  const openLift = id => nav('/progress/strength?ex=' + encodeURIComponent(id))

  return (
    <StagePage largeTitle={t('Training load')} sub={loadSub(S, today)} parent="/progress">
      <div className="g-load">
        <ActivityCard S={S} today={today} />
        <StageSegmented label={t('Training load')} value={shown} onChange={go} options={tabs} />
        {shown === 'balance' && <LoadBalance S={S} now={now} today={today} onMuscle={openMuscle} />}
        {shown === 'fatigue' && <LoadFatigue S={S} now={now} today={today} onMuscle={openMuscle} />}
        {shown === 'strength' && <LoadStrength S={S} now={now} onMuscle={openMuscle} onLift={openLift} />}
        {shown === 'effort' && <LoadEffort S={S} />}
      </div>
    </StagePage>
  )
}
