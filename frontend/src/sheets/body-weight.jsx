import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { fmtDate, fmtNum, todayISO } from '../lib/format.js'
import { lastBW } from '../lib/history.js'
import { t } from '../lib/i18n.js'
import { closeThenNav } from '../lib/nav.js'
import { convertBodyWeight } from '../lib/units.js'
import Icon from '../components/Icon.jsx'
import { NumberField } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import DsButton from '../ds/Button.jsx'
import { dayName } from '../lib/nutrition/log-feedback.js'
import { saveWeighIn, undoWeighIn } from '../lib/me/weigh-in.js'
import { ui, toast } from './shared.js'

/* ============================ weight limits ============================ */
const W_LO = 1
// A typed body weight may sit past any slider (a 320 kg lifter is real), but not past any
// person: 9999 saved, drew the chart from -0 to 10,000 and set a goal 9,922 kg away. The target
// weight drawer (views/me/goal/goal-drawers.jsx) holds to the same limit.
const bwMax = unit => (unit === 'lb' ? 1500 : 700)
export const bwTooHeavy = (n, unit) => {
  if (n <= bwMax(unit)) return false
  toast(t('That looks too heavy. Keep it at {0} or less.', fmtNum(bwMax(unit)) + ' ' + unit))
  return true
}

/* ============================ body weight ============================ */
// Board T1.7, the weigh-in drawer. `date`: the day the weigh-in is for (Home on a past day); today
// when absent. `required`: the check-in before a workout (startFlow), which `onDone` carries on.
const FAR_KG = 3
function BwSheet({ required, onDone, close, date, title }) {
  const st = useStore(s => s.S)
  const unit = st.unit
  const bw = lastBW(st)
  // Never a day to come: a weight logged ahead would read as the current one (lastBW).
  const day = date && date < todayISO() ? date : todayISO()
  const onDay = st.bodyweight.find(b => b.d === day)
  // The weigh-in this one is read against: the last before its day (its own, when re-weighing, is
  // the one being replaced).
  const prev = st.bodyweight.reduce((last, b) => (b.d < day && (!last || b.d > last.d) ? b : last), null)
  const [v, setV] = useState(onDay ? onDay.w : bw ? bw.w : 70)
  const step = by => setV(x => Math.max(W_LO, Math.round(((x || 0) + by) * 10) / 10))
  const n = Math.round((v || 0) * 10) / 10
  // A slip of a digit (81.4 typed 18.4, or 8.14) reads as a real change on the curve: say so before
  // saving. Saving still works, and Undo follows it.
  const far = prev && n > 0 && Math.abs(n - prev.w) > convertBodyWeight(FAR_KG, 'kg', unit)
  const save = () => {
    if (!n || n <= 0) { toast(t('Enter a valid weight')); return }
    if (bwTooHeavy(n, unit)) return
    // One per day, stamped now (lib/me/weigh-in.js), and sent to NutriTrace now rather than at the
    // hub's next poll.
    const before = saveWeighIn(day, n)
    close()
    if (onDone) onDone(n)
    else ui().toast(t('Saved {0} to {1}', fmtNum(n) + ' ' + unit, dayName(day)), { action: t('Undo'), onAction: () => undoWeighIn(day, before) })
  }
  // Locked when required (the check-in before a workout): swipe, scrim, Escape and back do nothing
  // (Modals.jsx), so a stray tap on Start is not walked back by reflex. The × still leaves it, as a
  // plain close: no onDone, no navigation, the screen underneath as it was.
  return <BottomSheet title={required ? t('Quick check-in') : title || t('Weigh-in')} chip={dayName(day)} onClose={required ? () => close() : undefined}
    footer={<>
      {/* Ticks only when the save will go through: a tick before "Enter a valid weight" would lie. */}
      <DsButton block haptic={!!n && n > 0 && !bwTooHeavy(n, unit)} onClick={save}>{required ? t('Save & start workout') : t('Save weigh-in')}</DsButton>
      {required && <>
        <DsButton block variant="secondary" onClick={() => { close(); onDone && onDone(null) }}>{t('Start without weighing in')}</DsButton>
        <DsButton block variant="ghost" icon="swap" onClick={() => closeThenNav(close, '/train/workout')}>{t('Choose a different workout')}</DsButton>
      </>}
    </>}>
    {required && <p className="g-wi-note">{t('We ask before your first workout each day so your curve stays honest.')}</p>}
    <div className="g-wi">
      <button type="button" className="g-wi-pm" onClick={() => step(-0.1)} aria-label={t('Decrease by {0}', fmtNum(0.1))}><Icon name="minus" className="g-icon" /></button>
      <label className="g-wi-read">
        <NumberField fit className="g-wi-num" value={v} onChange={setV} aria-label={t('Weight ({0})', unit)} enterKeyHint="done"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        <span className="g-wi-u">{unit}</span>
      </label>
      <button type="button" className="g-wi-pm" onClick={() => step(0.1)} aria-label={t('Increase by {0}', fmtNum(0.1))}><Icon name="plus" className="g-icon" /></button>
    </div>
    {/* Always mounted, only its text swapped: a live region that mounts with its text is often
        not announced. */}
    <p className="g-wi-far" role="status">{far ? t('{0} from your last weigh-in. Check it before you save.', fmtNum(Math.abs(Math.round((n - prev.w) * 10) / 10)) + ' ' + unit) : ''}</p>
    {onDay && <p className="g-wi-note g-wi-again">{day === todayISO()
      ? t('You weighed in today at {0}. Saving replaces it; Undo follows.', fmtNum(onDay.w) + ' ' + unit)
      : t('You weighed in on {0} at {1}. Saving replaces it; Undo follows.', fmtDate(day, true), fmtNum(onDay.w) + ' ' + unit)}</p>}
    {prev && <p className="g-wi-last">{t('Last weigh-in: {0} on {1}', fmtNum(prev.w) + ' ' + unit, fmtDate(prev.d, true))}</p>}
  </BottomSheet>
}
export function bwSheet(opts = {}) {
  return ui().openSheet(close => <BwSheet {...opts} close={close} />, { variant: 'ds', locked: !!opts.required })
}
