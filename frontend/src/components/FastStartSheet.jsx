import { useState } from 'react'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import ChipGroup from '../ds/ChipGroup.jsx'
import TextField from '../ds/TextField.jsx'
import { t } from '../lib/i18n.js'
import { START_BACKDATE_MS, endsAt, planLabelOf, startProblem, validGoal } from '../lib/nutrition/fasting.js'
import { useNow } from '../lib/nutrition/use-fasting.js'
import { useUI } from '../store/useUI.js'
import FastPlanChips from '../views/fasting/FastPlanChips.jsx'
import { dayTimeText, localInputValue, timeText } from '../views/fasting/fast-format.js'

const HOUR = 3600 * 1000

// Start a fast (board Ea6Start), the light drawer over the Fasting page: the plan, when it
// started (now, or earlier within the last 24 hours, never ahead) and when it would end. A start
// or goal the hub would refuse disables Start and says why. `onStart(hours, startAtIso|undefined)`
// resolves to null once started, else the sentence for why not. `now` is for the gallery, which
// freezes the clock; the app leaves it out and the drawer reads the time itself.
export default function FastStartSheet({ now: fixedNow, hour12, initialHours, onStart }) {
  const ticking = useNow(fixedNow === undefined, 30000)
  const now = fixedNow ?? ticking
  const [hours, setHours] = useState(initialHours)
  const [custom, setCustom] = useState(() => planLabelOf(initialHours) === null)
  const [when, setWhen] = useState('now')
  const [earlier, setEarlier] = useState(() => localInputValue(now - HOUR))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  const goal = Number(hours)
  const startMs = when === 'now' ? now : Date.parse(earlier)
  const problem = when === 'now' ? null : startProblem(startMs, now, START_BACKDATE_MS)
  const reason = !validGoal(goal) ? t('Enter a goal between 1 and 168 hours.')
    : problem === 'invalid' ? t('Enter a date and time.')
    : problem === 'future' ? t('The start cannot be in the future.')
    : problem === 'old' ? t('A fast can be started at most 24 hours back.')
    : null

  const start = async () => {
    setBusy(true)
    setFailed(null)
    const error = await onStart(goal, when === 'now' ? undefined : new Date(startMs).toISOString())
    if (error) { setFailed(error); setBusy(false) }
  }

  return (
    <BottomSheet title={t('Start a fast')} type="auto"
      footer={<Button block busy={busy} disabled={!!reason} onClick={start}>{t('Start {0} h fast', validGoal(goal) ? goal : '')}</Button>}>
      <div className="g-fast-sheet">
        <FastPlanChips tone="light" hours={goal} custom isCustom={custom}
          onPick={h => { setCustom(false); setHours(h) }} onCustom={() => setCustom(true)} />
        {custom && <TextField label={t('Goal in hours')} inputMode="numeric" value={String(hours)} onChange={setHours} />}
        <ChipGroup tone="light" label={t('Start time')} options={[{ value: 'now', label: t('Now') }, { value: 'earlier', label: t('Earlier') }]} value={when} onChange={setWhen} />
        {when === 'earlier' && <TextField label={t('Start time')} value={earlier} onChange={setEarlier}
          inputProps={{ type: 'datetime-local', min: localInputValue(now - START_BACKDATE_MS), max: localInputValue(now) }} />}
        <dl className="g-fast-sum">
          <div><dt>{t('Start time')}</dt><dd>{when === 'now' ? t('Now, {0}', timeText(now, hour12)) : Number.isFinite(startMs) ? dayTimeText(startMs, hour12) : '–'}</dd></div>
          <div><dt>{t('Ends')}</dt><dd>{Number.isFinite(startMs) && validGoal(goal) ? dayTimeText(endsAt(startMs, goal), hour12) : '–'}</dd></div>
        </dl>
        {(reason || failed) && <p className="g-bs-note g-fast-why" role="alert">{reason || failed}</p>}
      </div>
    </BottomSheet>
  )
}

export function fastStartSheet(props) {
  return useUI.getState().openSheet(() => <FastStartSheet {...props} />, { variant: 'ds' })
}
