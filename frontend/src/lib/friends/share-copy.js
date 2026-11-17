import { t } from '../i18n.js'
import { fmtDate } from '../format.js'
import { workoutDay, workoutDuration } from '../history.js'
import { plusDays } from '../missed-day.js'
import { weekTally } from '../queue.js'

// What a friend would see of you, in words (boards Fr1Groups, Fr1Empty, Fr5Sharing): the one place
// that turns the four switches into the preview rows' copy. The preview for the signed-in person
// is computed from their own state, and a line appears only when the data backs it: a switch that
// is off shows nothing (except New bests, which is off by default and says how it works), a
// switch that is on but has nothing to say yet shows nothing, and no number is invented.

/** The line under the preview: the fixed promise of Friends. */
export const neverShared = () => t('Never shared: weight, foods, what you ate, photos')

const WINDOW_DAYS = 7

function lastShared(S) {
  let best = null
  for (const w of S?.workouts || []) {
    if (w?.share?.off) continue
    const day = workoutDay(w)
    if (day && (!best || day > best.day)) best = { day, w }
  }
  return best
}

function trainingLine(S) {
  const last = lastShared(S)
  const title = last?.w?.name
  if (!title) return null
  const minutes = Math.round(workoutDuration(last.w) / 60000)
  return [title, fmtDate(last.day, true), minutes > 0 ? t('{0} min', minutes) : null].filter(Boolean).join(' · ')
}

function consistencyLine(S, today) {
  const { done, planned } = weekTally(S, today)
  return planned > 0 ? t('{0} of {1} planned workouts', done, planned) : null
}

function targetsLine(S, today) {
  const days = Array.from({ length: WINDOW_DAYS }, (_, k) => S?.targetsReached?.[plusDays(today, -k)]).filter(Boolean)
  if (!days.length) return null
  return t('Reached {0} of {1} days · no foods, no numbers', days.filter(d => d.all).length, days.length)
}

/**
 * The preview rows for `share` (`{ training, consistency, targets, bests }`) and the person's own
 * state `S`: `[{ key, title, sub }]`, only the ones that can be backed. `today` is a YYYY-MM-DD.
 */
export function previewRows(share, S, today) {
  const rows = []
  const add = (key, title, sub) => { if (sub) rows.push({ key, title, sub }) }
  if (share?.training) add('training', t('Training done'), trainingLine(S))
  if (share?.consistency) add('consistency', t('This week'), consistencyLine(S, today))
  if (share?.targets) add('targets', t('Food targets'), targetsLine(S, today))
  add('bests', t('New bests'), share?.bests ? t('On · only the exercise, never the weight') : t('Off · you share them one by one'))
  return rows
}
