import { useNavigate } from 'react-router-dom'
import { coachAvailable } from '../../../lib/coach.js'
import { COACH_COMING_SOON } from '../../../lib/coach-availability.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { starterPlanOptions } from '../../../lib/starter.js'
import { useStore } from '../../../store/useStore.js'
import { planCopy } from './plan-copy.js'

/**
 * What Ready-made plans (T10.0) shows: the plans it has copy for, in the chooser's order, each
 * `{ id, name, about, days }`; whether Coach can design one (the Coach row shows only then); and
 * where a tap goes.
 */
export function usePlans() {
  const nav = useNavigate()
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const plans = starterPlanOptions().flatMap(({ id, days }) => {
    const copy = planCopy(id)
    return copy ? [{ id, days, ...copy }] : []
  })
  return {
    plans,
    coach: !COACH_COMING_SOON && coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode }),
    openPlan: id => nav('/train/plans/' + id),
    askCoach: () => nav('/train/coach')
  }
}
