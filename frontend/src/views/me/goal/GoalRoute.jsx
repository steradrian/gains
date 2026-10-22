import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../../../lib/i18n.js'
import { useUnits } from '../../../lib/nutrition/use-units.js'
import { useUI } from '../../../store/useUI.js'
import GoalScreen from './GoalScreen.jsx'
import { announceSaved, bodyDetailsSheet, failureText, goalPickSheet, movementSheet, openHow, openTargets, targetWeightSheet } from './goal-drawers.jsx'
import { goalLabel, goalViewOf } from './goal-data.js'
import { useGoal } from './use-goal.js'

// /me/goal (Me3Goal): the goal hook, the drawers and the page. `?targets=1` (Today's "of 2,100" tap,
// the old Daily targets address) opens the Daily targets drawer once and clears itself with replace.
export default function GoalRoute() {
  const g = useGoal()
  const units = useUnits()
  const nav = useNavigate()
  const { pathname, search } = useLocation()
  const [keeping, setKeeping] = useState(false)
  const loaded = g.status === 'ready' || g.status === 'no-nutrition'

  useEffect(() => {
    if (!loaded || new URLSearchParams(search).get('targets') !== '1') return
    nav(pathname, { replace: true })
    openTargets()
  }, [loaded, search, pathname, nav])

  const keep = async () => {
    if (keeping) return
    setKeeping(true)
    const res = await g.actions.keepWeight()
    setKeeping(false)
    if (!res.ok) useUI.getState().toast(failureText(res.error))
    else if (res.changed) announceSaved(t('Goal changed to {0}', goalLabel('keep')), res)
  }

  const view = loaded ? goalViewOf(g, { energy: units.energy, water: units.water }) : null
  return (
    <GoalScreen
      status={g.status} view={view} keeping={keeping}
      onGoal={goalPickSheet} onTarget={targetWeightSheet} onBody={bodyDetailsSheet} onMovement={movementSheet}
      onTargets={openTargets} onHow={openHow} onKeep={keep} onRetry={() => g.actions.reload?.()} />
  )
}
