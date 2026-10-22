// What useMe() would hand MeScreen on the boards' day, Sunday 18 October 2026, for the Me root
// states (me-root.jsx). The weight slide, the days slide, the My goal card and the You rows come out
// of the real me-data.js and root-rows.js, given the store state below; the streak slide is spelled
// out (the real one reads the clock). In memory only.
import { daysSlide, goalCardOf, weightOf, weightSlide } from '../../../views/me/me-data.js'
import { ME_ROW_SLOTS, meRows } from '../../../views/me/root-rows.js'

export const NOOP = () => {}
export const HEADER = { initial: 'Ana', placeholder: 'Search Gains', unread: 0, onSettings: NOOP, onBell: NOOP, onSearch: NOOP }

const WEEK = '/me/week/2026-W42'
const energy = kcal => kcal.toLocaleString('en') + ' kcal'

/** Weigh-ins 84.8, 81.7 (10 Oct) and 81.4 (17 Oct): 3.4 kg to the 78 kg target, down 0.3 in 7 days. */
export const S_FULL = {
  unit: 'kg', targetW: 78,
  bodyweight: [{ d: '2026-09-01', w: 84.8 }, { d: '2026-10-10', w: 81.7 }, { d: '2026-10-17', w: 81.4 }],
}
export const S_NEW = { unit: 'kg', targetW: null, bodyweight: [] }
export const S_NO_TARGET = { ...S_FULL, targetW: null }
export const S_REACHED = { ...S_FULL, bodyweight: [{ d: '2026-09-01', w: 84.8 }, { d: '2026-10-10', w: 78.4 }, { d: '2026-10-17', w: 77.9 }] }

const STREAK = {
  key: 'streak', name: 'Streak', icon: 'flame', top: 'On plan', big: '6', hint: 'Open Week', unit: 'weeks in a row', value: 6, max: 8,
  pill: 'Best: 8 weeks', to: WEEK,
}

export const GOAL_READY = { status: 'ready', goal: 'lose', targets: { weeklyChangeKg: -0.4 }, profile: { calories: 2100 } }
export const GOAL_NEW = { status: 'ready', goal: 'lose', targets: null, profile: { calories: 2100 } }

const MUSCLES = { title: 'Week of 12 Oct', levels: { chest: 4, deltoids: 3, triceps: 3, 'upper-back': 2, biceps: 2, trapezius: 1, abs: 1 }, note: 'Legs not trained yet' }

/**
 * MeScreen's props for a store state. `days` is Eat's onTarget (null: the week has no judged day),
 * `food` false drops the days slide, `goal` is useGoal()'s answer, `invites` the admin's counts.
 */
export function meProps({ S = S_FULL, days = { days: 4, of: 6 }, food = true, goal = GOAL_READY, invites = { joined: 2, waiting: 1 }, changeCount = 3, muscles = MUSCLES, bodyLogged = true, slots = ME_ROW_SLOTS, canInvite = true } = {}) {
  const weight = weightOf(S)
  const kcal = goal.profile?.calories ? energy(goal.profile.calories) : null
  return {
    header: HEADER,
    rings: [weightSlide(weight), ...(food ? [daysSlide({ onTarget: days }, { kcal, to: WEEK })] : []), STREAK],
    onRing: NOOP,
    actions: [
      { key: 'weight', icon: 'scale', label: 'Log weight' },
      { key: 'measure', icon: 'ruler', label: 'Measure' },
      { key: 'photo', icon: 'camera', label: 'Photo' },
      ...(canInvite ? [{ key: 'invite', icon: 'envelope', label: 'Invite' }] : []),
    ],
    onAction: NOOP,
    goal: goalCardOf({ goal, weight, energy }),
    onGoal: NOOP,
    onKeep: NOOP,
    rows: meRows({ bodyLogged, changeCount, invites, canInvite }, slots),
    onRow: NOOP,
    muscles,
    onMuscles: NOOP,
  }
}

/** The row Friends will put in the You group (views/friends/me-rows.js), as a mock. */
export const GROUPS_ROW = { id: 'groups', icon: 'users', title: 'Groups', sub: 'no group yet', to: '/me/groups', tag: 'New' }
