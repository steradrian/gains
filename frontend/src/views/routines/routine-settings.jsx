import { Switch } from '../../components/ui.jsx'
import GlassValueRow from '../../ds/GlassValueRow.jsx'
import RadioRow from '../../ds/RadioRow.jsx'
import { glyphOf } from '../../lib/glyphs.js'
import { t } from '../../lib/i18n.js'
import { POLICIES_FOR, POLICY_DESC, POLICY_NAME } from '../../lib/progression.js'
import { glyphPicker } from '../../sheets.jsx'
import { useStore } from '../../store/useStore.js'

/* A routine's own settings (owner question 8: the T5.8 menu's "Routine settings"), which the
   board's editor has no place for: its icon, the progression its exercises follow unless they set
   their own, and whether it is a deload routine. The three writes below are the editor's, moved
   here (from the old RoutineEdit); each is in place on a store draft. */

const routineIn = (s, id) => s.routines.find(x => x.id === id)

export function setRoutineIcon(s, id, glyph) {
  const r = routineIn(s, id)
  if (r) r.emoji = glyph
}

export function setRoutineProgression(s, id, policy) {
  const r = routineIn(s, id)
  if (r) r.prog = policy
}

// Stored only when on: a routine that is not a deload one carries no flag at all.
export function setRoutineDeload(s, id, on) {
  const r = routineIn(s, id)
  if (!r) return
  if (on) r.excludeFromProgression = true
  else delete r.excludeFromProgression
}

/**
 * The drawer's body. Two controls that read alike and are not (issue #294): Progression picks how
 * this routine's own targets move, and "No automatic progression" keeps them where they are. The
 * Deload switch decides whether the routine's workouts count at all: a deload routine's sessions
 * open at its own numbers and are never the baseline the next regular session progresses from
 * (session-start.js, history.js entryExcluded).
 */
export default function RoutineSettings({ id }) {
  const r = useStore(s => routineIn(s.S, id))
  const update = useStore(s => s.update)
  if (!r) return null
  const prog = r.prog || 'linear'
  const deload = r.excludeFromProgression === true
  return (
    <div className="g-rt-settings">
      <div className="g-glist g-glist-light">
        <GlassValueRow icon={glyphOf(r.emoji)} title={t('Icon')} sub={t('Pick an icon')}
          onClick={() => glyphPicker(r.emoji, g => update(s => { setRoutineIcon(s, id, g) }))} />
        <GlassValueRow icon="chartLineSlash" title={t('Deload routine')}
          sub={t('Its workouts do not count toward progression. They still show in history and statistics.')} static
          trailing={<Switch checked={deload} aria-label={t('Deload routine')} onChange={v => update(s => { setRoutineDeload(s, id, v) })} />} />
      </div>
      <p className="g-rt-label" aria-hidden="true">{t('Progression')}</p>
      <div className="g-glist g-glist-light" role="radiogroup" aria-label={t('Progression')}>
        {POLICIES_FOR.reps.map(p => (
          <RadioRow key={p} title={t(POLICY_NAME[p])} sub={t(POLICY_DESC[p])} selected={p === prog}
            onClick={() => update(s => { setRoutineProgression(s, id, p) })} />
        ))}
      </div>
      <p className="g-rt-note">
        {deload
          ? t('A deload routine opens at the numbers set here, so the progression above does not apply to it.') + ' ' + t('The next regular target continues from the last included workout.')
          : t('Applies to every exercise in this routine that does not set its own rule.')}
      </p>
    </div>
  )
}
