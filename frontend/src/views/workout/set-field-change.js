// What a SetStepper's change does to the set it shows (WorkoutFocus.jsx). The stepper hands back
// value ± step for its − and +, or a typed number. A step on a dumbbell lift with owned bells
// walks from bell to bell (workout-actions stepLoad); everything else is written as given, through
// the field's `store` (speed in the profile's unit, a clamped incline). `field` is one of
// workout-view.js setFields().
import { setFieldAt, setSideFieldAt, stepFieldAt, stepSideFieldAt } from './workout-actions.js'

const STEP_EPS = 1e-6

export function changeSetField(idx, i, field, v) {
  const dir = Math.sign(v - field.value)
  const stepped = dir !== 0 && Math.abs(Math.abs(v - field.value) - field.step) < STEP_EPS
  if (field.weight && field.owned && stepped) {
    const col = { f: field.f, step: field.step }
    if (field.side) stepSideFieldAt(idx, i, field.side, col, dir, { owned: field.owned })
    else stepFieldAt(idx, i, col, dir, { weight: true, owned: field.owned })
    return
  }
  const stored = field.store ? field.store(v) : v
  if (field.side) setSideFieldAt(idx, i, field.side, field.f, stored)
  else setFieldAt(idx, i, field.f, stored)
}
