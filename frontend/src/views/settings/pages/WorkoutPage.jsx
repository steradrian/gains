import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { effortOf } from '../../../lib/history.js'
import { MOBILE } from '../../../lib/mobile.js'
import { REST_MAX, REST_PAUSE_MIN, REST_PAUSE_MAX, fmtRest, fmtDuration } from '../../../lib/duration.js'
import Icon from '../../../components/Icon.jsx'
import { Spacer } from '../../../components/layout.jsx'
import { SheetHeader } from '../../../components/sheet-layout.jsx'
import { durationSheet } from '../../../components/DurationWheel.jsx'
import { Section, Row, SelectRow, Switch, Segmented } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left, went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy, warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <SheetHeader title={t('Effort per set')} />
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small g-4" style={{ lineHeight: 1.5, display: 'grid' }}>
      <div>{t('RIR counts the reps you left in the tank; RPE reads the same effort off a 10-point scale, so RPE ≈ 10 − RIR. Pick whichever you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value, so progression and estimated 1RM are unaffected.')}</div>
    </div>
    <Spacer size={4} />
  </>)
}

export default function WorkoutPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { wakeOK } = useSettingsCtx()
  const layout = ['list', 'compact', 'focus'].includes(S.workoutView) ? S.workoutView : 'cards'

  const restRow = <Row icon="timer" iconTint="var(--orange)" title={t('Rest timer')} value={fmtRest(S.restSec)} accessory="chevron"
    onClick={() => durationSheet({
      title: t('Rest timer'), value: S.restSec, max: REST_MAX, off: t('Off'),
      footer: t('Scroll to 0:00 to turn the rest timer off.'),
      onDone: v => update(s => { s.restSec = v }),
    })} />
  // Default for a rest-pause burst added live on a plain set. A planned exercise's own "Rest (s)"
  // (in its drop set / burst config) overrides it, the same way the main rest timer is the
  // fallback for an exercise without a rest of its own. On the wheel too, 5 s to 5 min: the
  // burst's rest is never 0 (lib/history.js keeps it at 5 s at least), so the wheel stops there.
  const restPauseRow = <Row icon="bolt" iconTint="var(--orange)" title={t('Rest-pause rest')} value={fmtDuration(S.restPauseSec || 15)} accessory="chevron"
    onClick={() => durationSheet({
      title: t('Rest-pause rest'), value: S.restPauseSec || 15, min: REST_PAUSE_MIN, max: REST_PAUSE_MAX,
      footer: t('The short break between the bursts of a rest-pause set.'),
      onDone: v => update(s => { s.restPauseSec = v }),
    })} />

  return <>
    <Section title={t('Rest')} footer={t('Each exercise can have its own rest too. Set it in the exercise settings of a routine.')}>
      {restRow}
      {restPauseRow}
    </Section>
    <Section title={t('Logging')}>
      {/* Two names for the same judgement, so the column asks in the scale you already think in.
          The (i) sits before the control: you read it on the way to the choice, not after it. */}
      <Row icon="gauge" iconTint="var(--purple)" title={t('Effort per set')}>
        <button className="helpbtn" aria-label={t('What are RIR and RPE?')} onClick={effortHelpSheet}><Icon name="info" /></button>
        <Segmented className="seg-inline"
          options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
          value={effortOf(S)} onChange={v => update(s => { s.effort = v; delete s.showRir })} />
      </Row>
      {/* The line under each exercise that the rows are held against (#173). Tapping the line in
          a workout switches it too; this is where the choice can be found without knowing that. */}
      <SelectRow icon="history" iconTint="var(--blue)" title={t('Shown under each exercise')}
        value={S.logRef === 'best' ? 'best' : 'last'} onChange={v => update(s => { s.logRef = v })}
        options={[
          { value: 'last', label: t('Last time'), subtitle: t('What you did the last time, in that routine.') },
          { value: 'best', label: t('Best set'), subtitle: t('Your heaviest set of the exercise, from any workout.') },
        ]} />
      {/* One exercise at a time (cards with Prev/Next), the whole session stacked as a
          scrollable list, or that list stripped to just names and set rows (compact). Legacy or
          unknown values read as cards. The workout's ⋯ menu can override it for one session. */}
      <Row icon="layout" iconTint="var(--blue)" title={t('Layout')}>
        <Segmented className="seg-inline"
          options={[{ value: 'cards', label: t('Cards') }, { value: 'list', label: t('List') }, { value: 'compact', label: t('Compact') }, { value: 'focus', label: t('Focus') }]}
          value={layout} onChange={v => update(s => { s.workoutView = v })} />
      </Row>
      {/* The saved side of the Layout menu's "Collapse completed exercises" (#241): on here, every
          session starts with it, and the menu still flips it for one session. Setting it here
          also drops a running session's own choice, so the switch does what it says right away. */}
      <Row icon="minimize" iconTint="var(--teal)" title={t('Collapse completed exercises')}
        subtitle={t('In List and Compact, a finished exercise folds into one line.')}>
        <Switch aria-label={t('Collapse completed exercises')} checked={!!S.collapseCompleted}
          onChange={v => update(s => { s.collapseCompleted = v; if (s.active) delete s.active.collapseCompleted })} />
      </Row>
    </Section>
    <Section title={t('Before and during')}>
      {/* The quick weigh-in that opens on Start (sheets.jsx startFlow, issue #137); off skips
          straight to the session. Home and Stats still log weight by hand. */}
      <Row icon="scale" iconTint="var(--green)" title={t('Weigh in before workouts')}
        subtitle={t('Asks for your body weight when a workout starts. Off starts the session straight away.')}>
        <Switch checked={S.weighIn !== false} onChange={v => update(s => { s.weighIn = v })} />
      </Row>
      {(wakeOK || !MOBILE) && (
        <Row icon="phoneScreen" iconTint="var(--yellow)" title={t('Keep screen awake')}
          subtitle={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : t('Not supported in this browser.')}>
          <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
            onChange={v => update(s => { s.keepAwake = v })} />
        </Row>
      )}
      {/* 'full'/'mini' is also what the tap-toggle on the workout animation writes; 'off' hides
          workout media entirely (library, detail sheet and picker thumbs are unaffected).
          Legacy/unknown values read as 'full'. */}
      <Row icon="image" iconTint="var(--teal)" title={t('Exercise animations')}>
        <Segmented className="seg-inline"
          options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]}
          value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
          onChange={v => update(s => { s.gifSize = v })} />
      </Row>
    </Section>
  </>
}
