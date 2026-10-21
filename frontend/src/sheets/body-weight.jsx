import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { fmtDate, fmtNum, todayISO, weekStartOf } from '../lib/format.js'
import { lastBW } from '../lib/history.js'
import { t, tn } from '../lib/i18n.js'
import { closeThenNav } from '../lib/nav.js'
import { convertBodyWeight } from '../lib/units.js'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Chip, ChipRow, EmptyState } from '../components/blocks.jsx'
import { Inline } from '../components/layout.jsx'
import { SheetActions, SheetHeader } from '../components/sheet-layout.jsx'
import { Button, Slider, NumberField } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import DsButton from '../ds/Button.jsx'
import { dayName } from '../lib/nutrition/log-feedback.js'
import { syncNow } from '../lib/nutrition/sync.js'
import { deltaTone, weeklyWeights } from '../lib/bodyweight.js'
import { S, update, ui, toast } from './shared.js'
import { confirmSheet } from './confirm-menu.jsx'

/* ============================ weight picker (the goal sheet) ============================ */
// Fixed range, not a moving window — a window that resizes itself mid-drag (the previous
// attempt) makes the thumb's position unpredictable: every time it grows, everything already
// placed on it shifts toward one side. A static range never has that problem, at the cost of
// coarser precision per pixel — the +/- buttons, and typing straight into the read-out, cover
// exact values.
// The ceiling follows the profile's unit: 300 covers a body weight or a working weight in
// kg, but as pounds it cut off at 136 kg — below plenty of people's body weight, and well
// below an everyday squat.
const W_LO = 1
const wHi = unit => (unit === 'lb' ? 660 : 300)
// A typed body weight may sit past the slider (a 320 kg lifter is real), but not past any
// person: 9999 saved, drew the chart from -0 to 10,000 and set a goal 9,922 kg away.
const bwMax = unit => (unit === 'lb' ? 1500 : 700)
const bwTooHeavy = (n, unit) => {
  if (n <= bwMax(unit)) return false
  toast(t('That looks too heavy. Keep it at {0} or less.', fmtNum(bwMax(unit)) + ' ' + unit))
  return true
}
function WeightInput({ value, setValue, unit }) {
  const W_HI = wHi(unit)
  const clamp = x => Math.max(W_LO, Math.min(W_HI, Math.round((x || 0) * 10) / 10))
  const sv = Math.max(W_LO, Math.min(W_HI, value))
  const onSlide = v => setValue(clamp(v))
  const onType = v => setValue(v)

  return <>
    <div className="bwstep">
      <button className="bw-pm" onClick={() => onSlide(value - 0.1)} aria-label={t('Decrease by {0}', fmtNum(0.1))}><Icon name="minus" /></button>
      <label className="bw-read">
        <NumberField fit value={value} onChange={onType} aria-label={t('Weight ({0})', unit)} enterKeyHint="done"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        <span className="u"> {unit}</span>
      </label>
      <button className="bw-pm" onClick={() => onSlide(value + 0.1)} aria-label={t('Increase by {0}', fmtNum(0.1))}><Icon name="plus" /></button>
    </div>
    <ChipRow className="mt-4 mb-4" style={{ justifyContent: 'center' }}>
      <Chip onClick={() => onSlide(value - 1)}>−1</Chip>
      <Chip onClick={() => onSlide(value - 0.5)}>−0.5</Chip>
      <Chip onClick={() => onSlide(value + 0.5)}>+0.5</Chip>
      <Chip onClick={() => onSlide(value + 1)}>+1</Chip>
    </ChipRow>
    <Slider value={sv} min={W_LO} max={W_HI} step={0.5} onChange={onSlide} />
  </>
}

/* ============================ body weight ============================ */
// Board T1.7, the weigh-in drawer. `date`: the day the weigh-in is for (Home on a past day); today
// when absent. `required`: the check-in before a workout (startFlow), which `onDone` carries on.
const FAR_KG = 3
function BwSheet({ required, onDone, close, date }) {
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
    let before = null
    // `t` is when the weigh-in was logged, the sync's change stamp (lib/sync-merge.js stampChange
    // restamps it on every edit); charts place it by its day `d` (lib/bodyweight.js weighInTime).
    update(s => {
      const ex = s.bodyweight.find(b => b.d === day)
      before = ex ? { ...ex } : null
      if (ex) { ex.w = n; ex.t = Date.now() } else s.bodyweight.push({ d: day, w: n, t: Date.now() })
      s.bodyweight.sort((a, b) => (a.d < b.d ? -1 : 1))
    })
    // The weight goes to NutriTrace now rather than at the hub's next poll.
    void syncNow()
    close()
    if (onDone) onDone(n)
    else ui().toast(t('Saved {0} to {1}', fmtNum(n) + ' ' + unit, dayName(day)), { action: t('Undo'), onAction: () => undoWeighIn(day, before) })
  }
  // Locked when required (the check-in before a workout): swipe, scrim, Escape and back do nothing
  // (Modals.jsx), so a stray tap on Start is not walked back by reflex. The × still leaves it, as a
  // plain close: no onDone, no navigation, the screen underneath as it was.
  return <BottomSheet title={required ? t('Quick check-in') : t('Weigh-in')} chip={dayName(day)} onClose={required ? () => close() : undefined}
    footer={<>
      <DsButton block onClick={save}>{required ? t('Save & start workout') : t('Save weigh-in')}</DsButton>
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
    {prev && <p className="g-wi-last">{t('Last weigh-in: {0} on {1}', fmtNum(prev.w) + ' ' + unit, fmtDate(prev.d, true))}</p>}
  </BottomSheet>
}
export function bwSheet(opts = {}) {
  return ui().openSheet(close => <BwSheet {...opts} close={close} />, { variant: 'ds', locked: !!opts.required })
}

// Undo of a saved weigh-in: the day's entry goes, or gets back the weight it had, stamped now so
// the sync takes the change.
function undoWeighIn(day, before) {
  update(s => {
    s.bodyweight = s.bodyweight.filter(b => b.d !== day)
    if (before) {
      s.bodyweight.push({ ...before, t: Date.now() })
      s.bodyweight.sort((a, b) => (a.d < b.d ? -1 : 1))
    }
  })
  void syncNow()
}

// One weigh-in in the full list, with a delete that asks first: it is months of history scrolled
// through on a phone, and a stray tap on a trash button took a past weigh-in with nothing to bring
// it back.
function WeighInRow({ b, unit }) {
  const delEntry = () => update(s => { s.bodyweight = s.bodyweight.filter(x => x.d !== b.d) })
  const ask = () => confirmSheet({
    title: t('Delete weigh-in?'), message: `${fmtDate(b.d, true)} · ${fmtNum(b.w)} ${unit}`,
    confirmText: t('Delete'), danger: true, onConfirm: delEntry,
  })
  return <Inline justify="between" style={{ padding: '9px 2px', borderBottom: '1px solid var(--sep)' }}>
    <span className="small muted">{fmtDate(b.d, true)}</span>
    <Inline as="span"><b>{fmtNum(b.w)} {unit}</b>
      <button className="iconbtn fs-subhead ink-danger" style={{ width: 32, height: 30, borderRadius: 8 }} onClick={ask} aria-label={t('Delete weigh-in')}><Icon name="trash" /></button></Inline>
  </Inline>
}

/* ============================ weigh-ins ============================ */
// Every weigh-in, week by week (Discord 'Weight'): each week under its mean and how far that
// moved from the week before, the numbers behind the curve on the card. The chart plots the
// weekly means, since the swing from one morning to the next is what makes a single weigh-in
// hard to read. The weeks start on the profile's first day of the week.
function WeighIns() {
  const st = useStore(s => s.S)
  const ws = weekStartOf(st)
  const weeks = useMemo(() => weeklyWeights(st.bodyweight, ws), [st.bodyweight, ws])
  const points = useMemo(() => [...weeks].reverse()
    .map(w => ({ t: new Date(w.key + 'T12:00:00').getTime(), y: Math.round(w.avg * 100) / 100, d: w.key })), [weeks])
  const n = weeks.reduce((sum, w) => sum + w.n, 0)
  if (!n) return <>
    <SheetHeader title={t('Weigh-ins')} />
    <EmptyState illustration="scale" title={t('No weigh-ins yet')} body={t('Log your weight to start the curve.')} />
  </>
  return <>
    <SheetHeader title={t('Weigh-ins')} sub={tn('{0} weigh-in', '{0} weigh-ins', n)} />
    <div className="chart"><LineChart points={points} h={140} unit={st.unit} goal={st.targetW} label={t('Weight')} /></div>
    <div className="small dim mt-3">{t('Weekly average')}</div>
    {weeks.map(w => {
      // Only a change the display can show: at one decimal, 0.02 kg is "0", and an arrow over a
      // zero says something moved when, as far as the screen goes, nothing did.
      const moved = w.delta != null && fmtNum(Math.abs(w.delta)) !== fmtNum(0)
      return <div key={w.key} data-week={w.key}>
        <Inline justify="between" gap={4} style={{ margin: '16px 2px 4px' }}>
          <span className="small fw-semibold">{t('Week of {0}', fmtDate(w.key))}</span>
          <Inline as="span" gap={4} className="small">
            {moved && <Inline as="span" gap={1} className="fw-medium" style={{ color: bwDeltaColor(w.delta, w.avg) }}>
              <Icon name={w.delta > 0 ? 'arrowUp' : 'arrowDown'} className="fs-caption" />{fmtNum(Math.abs(w.delta))}
            </Inline>}
            <span className="muted" style={{ whiteSpace: 'nowrap' }}>{t('Average {0}', fmtNum(w.avg) + ' ' + st.unit)}</span>
          </Inline>
        </Inline>
        <div className="list g-0">{w.entries.map(b => <WeighInRow key={b.d} b={b} unit={st.unit} />)}</div>
      </div>
    })}
  </>
}
export const weighInsSheet = () => ui().openSheet(close => <WeighIns close={close} />)

/* ============================ target weight ============================ */
const DELTA_COLOR = { none: 'var(--label-2)', plain: 'var(--label)', toward: 'var(--acc-ink)', away: 'var(--red-ink)' }
export const bwDeltaColor = (delta, currentW) => DELTA_COLOR[deltaTone(delta, currentW, S().targetW)]
function GoalSheet({ close }) {
  const st = S()
  const bw = lastBW(st)
  const [v, setV] = useState(st.targetW || (bw ? bw.w : 70))
  return <>
    <SheetHeader title={t('Target weight')} />
    <div className="muted small">{t('Your goal is drawn as a line through the weight charts, and gains/losses are colored by whether they move toward it.')}</div>
    <WeightInput value={v} setValue={setV} unit={st.unit} />
    <SheetActions>
      <Button variant="primary" onClick={() => {
        const n = Math.round((v || 0) * 10) / 10
        if (!n || n <= 0) { toast(t('Enter a valid weight')); return }
        if (bwTooHeavy(n, st.unit)) return
        update(s => { s.targetW = n }); close()
        const b = lastBW(S()); toast(t('Goal set: {0}', fmtNum(n) + ' ' + st.unit) + (b ? ' (' + t('{0} to go', fmtNum(Math.abs(n - b.w))) + ')' : ''))
      }}>{t('Save goal')}</Button>
      {st.targetW ? <Button variant="danger" onClick={() => { update(s => { s.targetW = null }); close(); toast(t('Goal removed')) }}>{t('Remove goal')}</Button> : null}
    </SheetActions>
  </>
}
export const goalSheet = () => ui().openSheet(close => <GoalSheet close={close} />)
