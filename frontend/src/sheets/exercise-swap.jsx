import { useStore } from '../store/useStore.js'
import { EXIDX, allExercises, figureOf } from '../lib/exercises.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { fmtNum } from '../lib/format.js'
import { metricRowsForEntry, workoutAt } from '../lib/history.js'
import { t, exerciseNameFor, exerciseNameClass } from '../lib/i18n.js'
import { MUSCLE_NAME } from '../lib/muscles.js'
import { sameMuscleFirst } from '../lib/similar-exercises.js'
import ExerciseStillRow from '../components/ExerciseStillRow.jsx'
import Icon from '../components/Icon.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import { ui } from './shared.js'
import { exercisePicker } from './exercise-picker.jsx'

const SHOWN = 20

// The heaviest completed work set of the exercise's latest session, or null when it was never
// logged with a load. "You did …" is only ever said from this.
function lastDid(st, exId) {
  let latest = null
  for (const w of st.workouts || []) {
    const rows = (w.entries || []).filter(e => e.id === exId).flatMap(e => metricRowsForEntry(e, 'reps'))
    if (!rows.length) continue
    const at = workoutAt(w)
    if (!latest || at > latest.at) latest = { at, rows }
  }
  if (!latest) return null
  const best = latest.rows.reduce((a, s) => ((Number(s.w) || 0) > (Number(a.w) || 0) || ((Number(s.w) || 0) === (Number(a.w) || 0) && (Number(s.r) || 0) > (Number(a.r) || 0)) ? s : a))
  return Number(best.w) > 0 && Number(best.r) > 0 ? { w: Number(best.w), r: Number(best.r) } : null
}

// T5.7 Replace: the exercises that train the same muscle, the ones you can do with your equipment
// first, each with what you did last time when it has been logged. A row replaces at once; Search all
// exercises opens the picker, away from the same exercise.
function ReplaceDrawer({ exId, onPick, routine, title, close }) {
  const st = useStore(s => s.S)
  const ex = EXIDX[exId] || allExercises(st).find(e => e.id === exId) || null
  const profile = activeProfile(st)
  const figure = figureOf(st)
  // sameMuscleFirst puts the same kit first; the profile's own equipment leads that.
  const pool = ex ? sameMuscleFirst(allExercises(st), ex) : []
  const mine = profile ? pool.filter(e => exAvailable(st, e)) : pool
  const list = (profile ? [...mine, ...pool.filter(e => !exAvailable(st, e))] : pool).slice(0, SHOWN)

  const pick = e => { close(); onPick(e, true) }
  const searchAll = () => {
    const picker = exercisePicker((e, quick) => { picker.close(); close(); onPick(e, quick) }, { like: exId, title: t('Replace exercise'), routine })
  }
  const sub = e => {
    const did = lastDid(st, e.id)
    return [t(MUSCLE_NAME[e.tg] || e.tg || e.bp), t(e.eq), did && t('you did {0} × {1}', fmtNum(did.w) + ' ' + st.unit, fmtNum(did.r))].filter(Boolean).join(' · ')
  }
  return (
    <BottomSheet type="half" title={title || t('Replace {0}', ex ? exerciseNameFor(ex) : '')}
      head={<p className="g-sw-sub">{t('Similar exercises · same muscles, your equipment first')}</p>}
      footer={<Button variant="secondary" block icon="magnifier" onClick={searchAll}>{t('Search all exercises')}</Button>}>
      {list.length === 0 && <p className="g-pk-note">{t('No match')}</p>}
      {list.map((e, i) => (
        <ExerciseStillRow key={e.id} size={48} first={i === 0} ex={e} figure={figure}
          title={<i className={exerciseNameClass(e)}>{exerciseNameFor(e)}</i>} sub={sub(e)} onClick={() => pick(e)}
          trailing={<Icon name="swap" className="g-icon g-xrow-chev" />} />
      ))}
    </BottomSheet>
  )
}

/**
 * Opens T5.7 Replace for `exId`. `onPick(ex, quick)` is the picker's own contract: a row of the list
 * calls it with `quick` true (the board goes straight back to the routine, the slot's settings kept);
 * Search all exercises opens the picker and passes its pick through as it comes. Both drawers are
 * closed before `onPick` runs, so the caller closes nothing. `routine` is the routine's name for the
 * picker's header, `title` replaces "Replace {exercise}".
 */
export const replaceExerciseSheet = (exId, onPick, { routine, title } = {}) =>
  ui().openSheet(close => <ReplaceDrawer exId={exId} onPick={onPick} routine={routine} title={title} close={close} />, { variant: 'ds' })
