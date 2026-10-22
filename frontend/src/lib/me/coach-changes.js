// Journal kind `coach-move`: the Coach's applied plan edits, READ from `S.coach.planChanges`
// (lib/coach-plan-changes.js), never copied, so the journal and the Coach's own log cannot
// disagree. clearChanges does not touch that log.
//
// A row has an Undo only while the Coach can still undo it: revertLast (lib/coach.js, what the
// Coach chat's "Undo the last Coach changes" runs) takes back the LAST snapshot, so only the stamps
// of that proposal are offered, and not one that is already reverted (the stamp is kept, marked
// `reverted`, and that hides the row, as it hides the notification). Undoing any row of a proposal
// takes back all of them, and they leave the list together.
//
//   entry:   { id: 'coach:<stamp id>', at, day, subject, facts: { change, weekday?, from, to }, action: 'undo' }
//   change:  'moved' (from, to: weekdays 0-6, Sunday = 0) | 'set' (from null, to weekday; or a new plan)
//            | 'rest-day' (from weekday, to null; subject = the routine that was there) | 'added' |
//            'removed' (subject = routine name) | 'renamed' (subject = new name, from, to: names)
//
// There is no undo of the Undo: the Coach has none, so the toast offers nothing for this kind.
import { revertLast } from '../coach.js'
import { cleanPlanChange } from '../coach-plan-changes.js'
import { registerSource } from '../recent-changes.js'
import { useStore } from '../../store/useStore.js'

export const COACH_MOVE = 'coach-move'

const proposalOf = id => id.slice(0, id.indexOf(':'))
const nameIn = (snap, id) => (snap.routines || []).find(r => r?.id === id)?.name ?? null

// The weekdays `snap` (the plan before the apply) had the routine `name` on.
const daysOf = (snap, name) => Object.entries(snap.week || {})
  .filter(([, ids]) => [].concat(ids).some(id => nameIn(snap, id) === name))
  .map(([d]) => Number(d))
  .sort((a, b) => a - b)

function entryOf(stamp, snap) {
  const base = { id: `coach:${stamp.id}`, at: stamp.at, action: 'undo' }
  switch (stamp.type) {
    case 'week': {
      if (!stamp.routineName) {
        const was = [].concat(snap.week?.[stamp.weekday] || [])[0]
        return { ...base, subject: (was && nameIn(snap, was)) || '', facts: { change: 'rest-day', weekday: stamp.weekday, from: stamp.weekday, to: null } }
      }
      const from = daysOf(snap, stamp.routineName).find(d => d !== stamp.weekday)
      return from === undefined
        ? { ...base, subject: stamp.routineName, facts: { change: 'set', weekday: stamp.weekday, from: null, to: stamp.weekday } }
        : { ...base, subject: stamp.routineName, facts: { change: 'moved', weekday: stamp.weekday, from, to: stamp.weekday } }
    }
    case 'add-routine': return { ...base, subject: stamp.routineName, facts: { change: 'added', from: null, to: null } }
    case 'remove-routine': return { ...base, subject: stamp.routineName, facts: { change: 'removed', from: null, to: null } }
    case 'rename-routine': return { ...base, subject: stamp.to, facts: { change: 'renamed', from: stamp.from, to: stamp.to } }
    default: return { ...base, subject: '', facts: { change: 'set', from: null, to: null } }
  }
}

/** The Coach's undoable changes in `S`, newest last. [] when the Coach has none (it is "coming soon" on some builds). */
export function coachMoves(S) {
  const stamps = S?.coach?.planChanges
  const snap = Array.isArray(S?.coach?.snapshots) ? S.coach.snapshots.at(-1) : null
  if (!Array.isArray(stamps) || !stamps.length || !snap?.proposalId) return []
  return stamps.flatMap(raw => {
    const stamp = cleanPlanChange(raw)
    if (!stamp || stamp.reverted || proposalOf(stamp.id) !== snap.proposalId) return []
    return [entryOf(stamp, snap)]
  })
}

/** Runs the Coach's own Undo of the last change-set. */
export function undoCoachMove() {
  let done = false
  useStore.getState().update(s => { done = revertLast(s) })
  return done ? { ok: true } : { ok: false, reason: 'gone' }
}

registerSource(COACH_MOVE, (S, now) => coachMoves(S).filter(e => e.at <= now), { restore: undoCoachMove })
