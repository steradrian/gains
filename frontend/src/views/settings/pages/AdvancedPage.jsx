import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { workoutControls } from '../../../lib/workout-controls.js'
import { Section, Row, SelectRow, Switch } from '../../../components/ui.jsx'

export default function AdvancedPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  // S.wc overlays DEF.wc, so a profile from before these switches existed reads as the lean default.
  const wc = workoutControls(S)
  const setWc = (k, v) => update(s => { s.wc = { ...workoutControls(s), [k]: v } })
  return <>
    <Section title={t('Sessions and timed sets')}>
      {/* Whose reps a planned session opens with (lib/session-start.js). The plan's by default:
          the routine is what you said you would do, and history and progression decide the
          weight. The other choice is the old behaviour, reps carried over from last time.
          Absent (an older profile) reads as the plan. */}
      <SelectRow icon="clipboard" iconTint="var(--green)" title={t('Planned sessions start from')}
        value={S.startFrom === 'last' ? 'last' : 'plan'} onChange={v => update(s => { s.startFrom = v })}
        options={[
          { value: 'plan', label: t('Your plan'), subtitle: t('The routine’s sets and reps. Your history decides the weight.') },
          { value: 'last', label: t('Your last session'), subtitle: t('The reps you logged last time in that routine, carried over.') },
        ]} />
      <Row icon="stopwatch" iconTint="var(--orange)" title={t('Keep timing after target')}
        subtitle={t('Timed sets continue up to 15 extra minutes. Tap Done to log the actual duration.')}>
        <Switch aria-label={t('Keep timing after target')} checked={!!S.timedSetOvertime}
          onChange={v => update(s => { s.timedSetOvertime = v })} />
      </Row>
    </Section>
    {/* The lean workout screen keeps the sets and one "more" button per exercise; each switch
        brings one of the old always-visible button groups back for people who liked them. */}
    <Section title={t('Buttons on the workout screen')} footer={t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}>
      <Row icon="plusCircle" iconTint="var(--green)" title={t('Weight and reps buttons')} subtitle={t('Off: tap the number and type it')}>
        <Switch checked={wc.steppers} onChange={v => setWc('steppers', v)} />
      </Row>
      <Row icon="bolt" iconTint="var(--orange)" title={t('Drop and burst shortcuts on every set')}>
        <Switch checked={wc.setShortcuts} onChange={v => setWc('setShortcuts', v)} />
      </Row>
      {/* Swipe actions (v1.3.11): not a button, but the same question of what a set row does. The
          one switch covers Plan's lists too; the stored key keeps its old name, swipeSets. */}
      <Row icon="swap" iconTint="var(--indigo)" title={t('Swipe actions')} subtitle={t('Sets, routines and the loop: left removes, right copies')}>
        <Switch aria-label={t('Swipe actions')} checked={wc.swipeSets} onChange={v => setWc('swipeSets', v)} />
      </Row>
      {/* The chip row at the top of a workout (#323): not a button row, but the same question of
          what the workout screen shows. On by default, it is about one line tall. */}
      <Row icon="more" iconTint="var(--mint)" title={t('Exercise chips at the top')} subtitle={t('A numbered dot per exercise, filled as you go. Tap one to jump there.')}>
        <Switch aria-label={t('Exercise chips at the top')} checked={wc.exerciseChips} onChange={v => setWc('exerciseChips', v)} />
      </Row>
      <Row icon="link" iconTint="var(--blue)" title={t('Superset buttons in the exercise header')}>
        <Switch checked={wc.pairButtons} onChange={v => setWc('pairButtons', v)} />
      </Row>
      <Row icon="swap" iconTint="var(--teal)" title={t('Move, swap and remove buttons below the exercise')}>
        <Switch checked={wc.exerciseButtons} onChange={v => setWc('exerciseButtons', v)} />
      </Row>
    </Section>
  </>
}
