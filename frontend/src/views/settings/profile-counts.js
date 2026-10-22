import { t, tn } from '../../lib/i18n.js'
import { referencedFiles } from '../../lib/media-refs.js'

const len = list => (Array.isArray(list) ? list.length : 0)

/**
 * What this profile holds, counted from the copy on this device (the same state Start over wipes
 * and the server keeps): workouts, routines, whether there is a Plan (a weekday set, a rotation
 * or a planner's queue), custom exercises, weigh-ins, measurements, photos and videos.
 */
export function profileCounts(S) {
  const s = S || {}
  return {
    workouts: len(s.workouts),
    routines: len(s.routines),
    plan: Object.values(s.week || {}).some(Boolean) || !!s.rotation || !!s.queue,
    customEx: len(s.customEx),
    weighIns: len(s.bodyweight),
    measurements: len(s.measurements),
    media: S ? referencedFiles(S).length : 0,
  }
}

/** "212 workouts, 6 routines, your Plan": the training parts there are, or '' for none. */
export const trainingLine = c => [
  c.workouts > 0 && tn('{0} workout', '{0} workouts', c.workouts),
  c.routines > 0 && tn('{0} routine', '{0} routines', c.routines),
  c.customEx > 0 && tn('{0} custom exercise', '{0} custom exercises', c.customEx),
  c.plan && t('your Plan'),
].filter(Boolean).join(', ')

/** "64 weigh-ins, 41 measurements", or '' for none. */
export const bodyLine = c => [
  c.weighIns > 0 && tn('{0} weigh-in', '{0} weigh-ins', c.weighIns),
  c.measurements > 0 && tn('{0} measurement', '{0} measurements', c.measurements),
].filter(Boolean).join(', ')

/** "6 photos or videos", or '' for none. */
export const mediaLine = c => (c.media > 0 ? tn('{0} photo or video', '{0} photos or videos', c.media) : '')
