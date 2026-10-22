import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { useRootHeader } from '../../components/use-root-header.js'
import { weekKey, weekStartOf } from '../../lib/format.js'
import { t } from '../../lib/i18n.js'
import { isoWeekOf, weekPath } from '../../lib/day-route.js'
import { useFriendsMe } from '../../lib/friends/use-friends.js'
import { measurementEntryHasValues } from '../../lib/measurements.js'
import { canInvite, groupInvites, loadInvites } from '../../lib/me/invites.js'
import { allPhotos } from '../../lib/me/photos.js'
import { useFoodOn } from '../../lib/nutrition/food-on.js'
import { useUnits } from '../../lib/nutrition/use-units.js'
import { listChanges } from '../../lib/recent-changes.js'
import { useFoodDays } from '../eat/use-eat.js'
import { heroOf } from '../eat/eat-data.js'
import { foodDaysOf } from '../shared/week-data.js'
import { musclesThisWeekOf } from '../train/use-train.js'
import { useTodayDate } from '../today/use-today.js'
import { actionsOf, goalCardOf, ringsOf, weightOf } from './me-data.js'
import { useGoal } from './goal/use-goal.js'
import { meRows } from './root-rows.js'

const bodyLoggedOf = S => (S.bodyweight || []).length > 0 || (S.measurements || []).some(measurementEntryHasValues) || allPhotos(S).length > 0

// "2 joined, 1 waiting" for the Invite a friend row: fetched once on open, and only for an admin
// (a member has no endpoint to read). A failed load leaves the row's plain line.
function useInviteCounts(admin) {
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    if (!admin) return undefined
    let live = true
    loadInvites()
      .then(d => { if (live) { const g = groupInvites(d.invites); setCounts({ joined: g.joined.length, waiting: g.waiting.length }) } })
      .catch(() => {})
    return () => { live = false }
  }, [admin])
  return admin ? counts : null
}

/**
 * The Me root (PR-05 M1.0 to M1.2) as MeScreen draws it:
 *   header     the pinned header (avatar, search, bell)
 *   rings      the ring carousel's slides; `onRing(slide)` follows a slide's `to`, or `log`
 *   actions    the quick actions (`key`, `icon`, `label`); MeRoute runs them (they open drawers)
 *   goal       the My goal card (me-data.js goalCardOf) and `onKeep` for Keep my weight
 *   rows       the You group (root-rows.js)
 *   muscles    Your muscles this week, null until a workout is logged
 */
export function useMe() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const header = useRootHeader('me')
  const today = useTodayDate()
  const units = useUnits()
  const goal = useGoal()
  useFriendsMe()   // the Groups row (views/friends/me-rows.js) says what the cache holds: draw again when it changes
  const foodOn = useFoodOn()
  const start = weekKey(today, weekStartOf(S))
  const days = useMemo(() => foodDaysOf(start, today), [start, today])
  const food = useFoodDays(foodOn, days)
  const admin = !!user?.admin
  const mayInvite = canInvite(user)
  const invites = useInviteCounts(admin && mayInvite)
  const changeCount = useMemo(() => listChanges().length, [S])

  const weight = weightOf(S)
  const weekTo = weekPath(isoWeekOf(today, weekStartOf(S)), 'me')
  const kcal = goal.profile?.calories ? units.energy(goal.profile.calories) : null
  // Days on target waits for the diary settings: no slide that flashes 0 and then jumps.
  const rings = ringsOf({ S, hero: heroOf({ start, today, food }), foodOn: foodOn && !!food.settings, kcal, weekTo })

  const keepWeight = async () => {
    const r = await goal.actions.keepWeight()
    const toast = useUI.getState().toast
    if (!r.ok) { toast(t('Could not keep your weight')); return }
    toast(t('Goal is now Keep weight'), { action: t('Undo'), onAction: () => { r.undo() } })
  }

  return {
    header,
    rings,
    onRing: slide => { if (slide?.to) nav(slide.to) },
    actions: actionsOf({ canInvite: mayInvite }),
    goal: goalCardOf({ goal, weight, energy: units.energy }),
    onGoal: () => nav('/me/goal'),
    onKeep: keepWeight,
    rows: meRows({ bodyLogged: bodyLoggedOf(S), changeCount, invites, canInvite: mayInvite, user }),
    muscles: S.workouts?.length ? musclesThisWeekOf(S, today) : null,
    onMuscles: () => nav('/progress/load'),
  }
}
