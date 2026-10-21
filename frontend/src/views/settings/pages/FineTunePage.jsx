import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { workoutControls } from '../../../lib/workout-controls.js'
import StageNote from '../../../ds/StageNote.jsx'
import StageSegmented from '../../../ds/StageSegmented.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'

// Fine-tuning (board St1FineTune, A1.16): the workout screen's finer switches. S.wc overlays DEF.wc,
// so a profile from before these switches existed reads as the lean default.
export default function FineTunePage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const wc = workoutControls(S)
  const setWc = (k, v) => update(s => { s.wc = { ...workoutControls(s), [k]: v } })
  const wcRow = (key, icon, title, sub) => (
    <SettingRow icon={icon} title={title} sub={sub} trailing={<StageSwitch label={title} checked={wc[key]} onChange={v => setWc(key, v)} />} />
  )
  return (
    <SettingsPage title={t('Fine-tuning')} line={t('How the workout screen behaves')}>
      <div className="set-body">
        <div className="g-glist g-glass">
          {/* Whose reps a planned session opens with (lib/session-start.js). The plan's by default;
              the other choice carries last time's reps over. Absent reads as the plan. */}
          <SettingRow icon="clipboard" title={t('Planned sessions start from')} sub={t('What fills in weight and reps')}
            below={<StageSegmented label={t('Planned sessions start from')} value={S.startFrom === 'last' ? 'last' : 'plan'}
              options={[{ value: 'plan', label: t('Your plan') }, { value: 'last', label: t('Your last session') }]}
              onChange={v => update(s => { s.startFrom = v })} />} />
          <SettingRow icon="stopwatch" title={t('Keep timing after target')} sub={t('A timed set keeps counting past its goal')}
            trailing={<StageSwitch label={t('Keep timing after target')} checked={!!S.timedSetOvertime} onChange={v => update(s => { s.timedSetOvertime = v })} />} />
        </div>
        <div className="g-glist g-glass">
          {wcRow('steppers', 'plusCircle', t('Weight and reps buttons'), t('− and + next to every number'))}
          {wcRow('setShortcuts', 'bolt', t('Drop and burst shortcuts'), t('On every set row'))}
          {/* One switch covers Plan's lists too; the stored key keeps its old name, swipeSets. */}
          {wcRow('swipeSets', 'swap', t('Swipe actions'), t('Sets, routines and the loop: left removes, right copies'))}
          {wcRow('exerciseChips', 'more', t('Exercise chips at the top'), t('A numbered dot per exercise, filled as you go. Tap one to jump there.'))}
          {wcRow('pairButtons', 'link', t('Superset buttons in the header'), t('Pair two exercises'))}
          {wcRow('exerciseButtons', 'swap', t('Move, swap and remove buttons'), t('Below each exercise'))}
        </div>
        <StageNote>{t('For people who want it exactly their way. The defaults are what most of the group uses.')}</StageNote>
      </div>
    </SettingsPage>
  )
}
