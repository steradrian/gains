// The workout's start and finish drawers (finish-M2): the warm-up offer W1.31, the cool-down offer
// W1.40, Finish W1.10 / W1.11, the discard confirm W1.46 (then the Undo toast W1.26 on Today) and
// the workout left open W1.27. Each is one DS light BottomSheet; a second step (the discard after
// Finish, Finish after Skip and finish) happens inside the same drawer, never as a drawer over it.
// The openers are in finish-drawers.js.
import { useRef, useState } from 'react'
import BottomSheet from '../../ds/BottomSheet.jsx'
import Button from '../../ds/Button.jsx'
import ConfirmDrawer from '../../ds/ConfirmDrawer.jsx'
import DetailRow from '../../ds/DetailRow.jsx'
import PhaseOfferSheet from '../../ds/PhaseOfferSheet.jsx'
import StatTiles from '../../ds/StatTiles.jsx'
import Tag from '../../ds/Tag.jsx'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { t, tn, dateLocale } from '../../lib/i18n.js'
import { exOr } from '../../lib/exercises.js'
import { exCount, exerciseNameText, fmtDate, isoOf } from '../../lib/format.js'
import { isPerSide, modeOf } from '../../lib/history.js'
import { isWarmupRow } from '../../lib/workout-model.js'
import { partOf } from '../../lib/workout-parts.js'
import { finishFacts } from '../../lib/workout-finish.js'
import { discardFacts, discardWithUndo, DISCARD_UNDO_MS } from '../../lib/workout-discard.js'
import { staleFacts, saveStale } from '../../lib/stale-workout.js'
import { nav, closeThenNav, navToWorkout, onSheetEntry, sheetEntriesLive } from '../../lib/nav.js'
import { popToRoot } from '../../lib/use-tab-nav.js'
import { beginWorkout, finishToSummary } from '../../sheets.jsx'
import { pictureOf } from '../train/use-train.js'
import { planLine, readyOf } from './use-ready.js'
import { setPartSkipped } from './workout-actions.js'
import { holdReopen, markLeaving } from './finish-drawers.js'

/* ============================ helpers ============================ */

// A drawer's facts as they last were: a finish or a discard clears S.active while the drawer is
// still closing, and it must not go blank on its way out.
function useKept(value) {
  const kept = useRef(value)
  if (value) kept.current = value
  return kept.current
}

// Closes the drawer, then runs `go` once its history entry has been walked off (Modals.jsx), as
// lib/nav.js closeThenReplace does for a path: the start then replaces Ready's own entry rather
// than the drawer's, so one back from the session leaves it and never lands on Ready again.
const WALK_OFF_MS = 400
function closeThenRun(close, go) {
  if (!onSheetEntry() || sheetEntriesLive() < 1) { close(); go(); return }
  let done = false
  const run = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    globalThis.removeEventListener('popstate', run)
    go()
  }
  const timer = setTimeout(run, WALK_OFF_MS)
  globalThis.addEventListener('popstate', run)
  close()
}

const capFirst = s => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

// An offer's row line is the plan without its kind ("2 × 15", not "Body weight · 2 × 15"): the
// kind prefix use-ready.js planLine puts on, taken off again.
export function withoutKind(id, line) {
  const eq = exOr(id)?.eq
  for (const kind of [t('Timed'), eq ? capFirst(t(eq)) : null]) {
    if (kind && line.startsWith(kind + ' · ')) return line.slice(kind.length + 3)
  }
  return line
}

const timeOf = ms => new Date(ms).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
const dayOf = ms => fmtDate(isoOf(new Date(ms)), true)
const HOUR = 60 * 60 * 1000
const openForText = ms => {
  const h = Math.floor(ms / HOUR)
  return h < 48 ? t('{0} h', h) : tn('{0} day', '{0} days', Math.floor(h / 24))
}

/* ============================ the discard (W1.46, then W1.26) ============================ */

// Whether any set the discard takes is a warm-up one (a warm-up row or an exercise of the
// warm-up part): only then does the confirm say "warm-up included".
const warmupLogged = A => (A?.entries || []).some(e => (e?.sets || []).some(s => s?.done && (isWarmupRow(s) || partOf(e) === 'warmup')))

/**
 * The discard itself: the session goes, the drawer closes and, unless `stay` (left open, already
 * on Today), the app lands on Today's root. Not a back(): the workout may have been opened from
 * any tab, and popToRoot('home') takes the workout's entry off whichever stack it sat on while
 * that tab keeps its own pages (lib/tab-history.js planSwitch compacts the workout out). It waits
 * for the drawer's entry first (use-tab-nav.js afterSheet). Then Undo for 8 s on Today: the
 * session back, and into it again (from left open it stays on Today, where it was found).
 */
export function discardNow(close, { stay = false } = {}) {
  if (!stay) markLeaving()
  const gone = discardWithUndo()
  close()
  if (!gone) return
  if (!stay) popToRoot('home')
  useUI.getState().toast(gone.text, {
    action: t('Undo'), ms: DISCARD_UNDO_MS,
    onAction: () => { if (gone.undo() && !stay) nav('/train/workout') },
  })
}

// Discard workout from any drawer: the confirm step when something is logged, else at once.
const askDiscard = (facts, close, toStep, opts) => (facts?.confirm ? toStep() : discardNow(close, opts))

export const discardTitle = facts => tn('Discard {0} set?', 'Discard {0} sets?', facts?.sets || 0)

/** W1.46's content: what goes, then Discard workout / Keep going. Shared by every discard. */
export function DiscardStep({ facts, warmup, onConfirm, onCancel }) {
  const n = facts?.sets || 0
  return (
    <ConfirmDrawer
      body={t('{0} closes and these go:', facts?.name)}
      items={[
        warmup ? tn('{0} logged set, warm-up included', '{0} logged sets, warm-up included', n) : tn('{0} logged set', '{0} logged sets', n),
        t('{0} on the clock', facts?.clockText),
        t('Nothing reaches History, bests or the muscle map'),
      ]}
      note={t('You can still undo for {0} s on Today.', DISCARD_UNDO_MS / 1000)}
      confirmLabel={t('Discard workout')} onConfirm={onConfirm}
      cancelLabel={t('Keep going')} onCancel={onCancel} />
  )
}

/* ============================ Finish (W1.10, W1.11) ============================ */

/** Finish's content from lib/workout-finish.js finishFacts: tiles, bests or what is left, the three ways out. */
export function FinishStep({ facts, onFinish, onKeep, onDiscard }) {
  const { kind } = facts
  const worked = kind === 'done' || kind === 'early'
  return (
    <div className="g-confirm">
      {worked && (
        <StatTiles items={[
          { label: t('Time'), value: facts.clockText },
          { label: t('Sets'), value: String(facts.sets) },
          { label: t('Volume'), value: facts.volumeText },
        ]} />
      )}
      {kind === 'done' && facts.bestsCount && <p><Tag tone="positive" icon="trophy">{facts.bestsCount}</Tag> {facts.bestsLine}</p>}
      {kind === 'early' && <p><b>{facts.headline}</b> {facts.sentence}</p>}
      {!worked && <p>{facts.message || t('You haven’t checked off any sets. Finish anyway?')}</p>}
      <Button block onClick={onFinish}>{kind === 'done' ? t('Finish and save') : t('Finish anyway')}</Button>
      <Button block variant="secondary" onClick={onKeep}>{t('Keep going')}</Button>
      <Button block variant="danger" onClick={onDiscard}>{t('Discard workout')}</Button>
    </div>
  )
}

// The running session's finish and discard facts, kept through the drawer's way out.
function useSessionFacts() {
  const st = useStore(s => s.S)
  const now = Date.now()
  const A = st.active
  return {
    A,
    finish: useKept(A ? finishFacts(st, A, now) : null),
    discard: useKept(A ? discardFacts(A, now) : null),
    warmup: useKept(A ? { on: warmupLogged(A) } : null)?.on,
  }
}

// Finish and its discard step as one drawer's body. A plain function, not a component, so every
// drawer that ends in it keeps one BottomSheet across its steps (same element at the same place).
function finishSteps({ step, setStep, close, facts }) {
  if (step === 'discard') {
    return (
      <BottomSheet type="auto" title={discardTitle(facts.discard)}>
        <DiscardStep facts={facts.discard} warmup={facts.warmup} onConfirm={() => discardNow(close)} onCancel={close} />
      </BottomSheet>
    )
  }
  if (!facts.finish) return null
  return (
    <BottomSheet type="auto" title={facts.finish.title}>
      <FinishStep facts={facts.finish}
        onFinish={() => finishToSummary(close)}
        onKeep={close}
        onDiscard={() => askDiscard(facts.discard, close, () => setStep('discard'))} />
    </BottomSheet>
  )
}

/** W1.10 / W1.11, its Discard W1.46 a step inside it. */
export function FinishDrawer({ close }) {
  const [step, setStep] = useState('finish')
  const facts = useSessionFacts()
  return finishSteps({ step, setStep, close, facts })
}

/** W1.46 on its own (W1.30's Discard, Workout options). */
export function DiscardDrawer({ close }) {
  const facts = useSessionFacts()
  return (
    <BottomSheet type="auto" title={discardTitle(facts.discard)}>
      <DiscardStep facts={facts.discard} warmup={facts.warmup} onConfirm={() => discardNow(close)} onCancel={close} />
    </BottomSheet>
  )
}

/* ============================ the offers (W1.31, W1.40) ============================ */

// A session starts only where none runs: a start over a running one would replace it.
function begin(ids, bw, opts) {
  if (useStore.getState().S.active) { navToWorkout(); return }
  beginWorkout(ids, bw, opts)
}

/** W1.31 over Ready: the warm-up group of the session Start workout begins. */
export function WarmupOfferDrawer({ close, ids, bw = null }) {
  const st = useStore(s => s.S)
  const group = useKept(readyOf(st, ids)?.groups.find(g => g.part === 'warmup') || null)
  return (
    <BottomSheet type="auto" title={t('Start with your warm-up')}>
      <PhaseOfferSheet tone="warm" tag={group?.label}
        body={t('Logged like any exercise: sets and reps count in your history and muscle map, never for new bests.')}
        items={(group?.rows || []).map(r => ({ image: r.image, name: r.name, sub: withoutKind(r.id, r.line) }))}
        startLabel={t('Start warm-up')} onStart={() => closeThenRun(close, () => begin(ids, bw))}
        skipLabel={t('Skip warm-up')} onSkip={() => closeThenRun(close, () => begin(ids, bw, { skipWarmup: true }))} />
    </BottomSheet>
  )
}

const workRows = e => (e.sets || []).filter(s => !isWarmupRow(s)).length || Number(e.target?.sets) || 1

/**
 * W1.40's facts for the running session, from its data only: `{ count, tag, body, items }`, or
 * null without a cool-down. "N stretches" only when every entry is a timed hold, else "N
 * exercises"; "about N min" only when every entry has planned seconds (seconds × rows × sides);
 * the timed-hold sentence only when every entry is one, its other-side clause only with a side.
 */
export function cooldownOfferOf(st, A) {
  const entries = (A?.entries || []).filter(e => partOf(e) === 'cooldown')
  if (!entries.length) return null
  const cfgs = entries.map(e => ({ ...(e.target || {}), id: e.id }))
  const timed = cfgs.every(c => modeOf(c) === 'time')
  const sided = cfgs.some(isPerSide)
  const secs = entries.map((e, i) => {
    const sec = Number(cfgs[i].sec)
    return modeOf(cfgs[i]) === 'time' && sec > 0 ? sec * workRows(e) * (isPerSide(cfgs[i]) ? 2 : 1) : null
  })
  const total = secs.every(s => s != null) ? secs.reduce((a, b) => a + b, 0) : null
  const n = entries.length
  const count = timed ? tn('{0} stretch', '{0} stretches', n) : exCount(n)
  const lead = total ? t('{0}, about {1} min.', count, Math.max(1, Math.round(total / 60))) : count + '.'
  const holds = timed ? (sided ? t('Each one is a timed hold; the other side starts on its own.') : t('Each one is a timed hold.')) : null
  return {
    count: n,
    tag: t('Cool-down') + ' · ' + n,
    body: [lead, holds].filter(Boolean).join(' '),
    items: entries.map(e => ({ image: pictureOf(st, e.id), name: exerciseNameText(exOr(e.id)), sub: withoutKind(e.id, planLine(e)) })),
  }
}

/** W1.40 over the running screen; Skip and finish goes on to Finish inside the same drawer. */
export function CooldownOfferDrawer({ close }) {
  const [step, setStep] = useState('offer')
  const st = useStore(s => s.S)
  const offer = useKept(cooldownOfferOf(st, st.active))
  const facts = useSessionFacts()
  if (step !== 'offer') return finishSteps({ step, setStep, close, facts })
  const start = () => {
    close()
    useStore.getState().update(s => {
      const at = (s.active?.entries || []).findIndex(e => partOf(e) === 'cooldown')
      if (at >= 0) s.active.cur = at
    })
  }
  const skip = () => { setPartSkipped('cooldown', true); setStep('finish') }
  return (
    <BottomSheet type="auto" title={t('Cool-down')}>
      <PhaseOfferSheet tone="cool" tag={offer?.tag} body={offer?.body} items={offer?.items || []}
        startLabel={t('Start cool-down')} onStart={start}
        skipLabel={t('Skip and finish')} onSkip={skip} />
    </BottomSheet>
  )
}

/* ============================ left open (W1.27) ============================ */

/** W1.27's copy from lib/stale-workout.js staleFacts. */
export function staleCopy(facts) {
  const n = facts.setsLogged
  return {
    title: t('{0} is still open', facts.name),
    body: t('Started {0} at {1} and never finished.', dayOf(facts.started), timeOf(facts.started)) + ' '
      + (n ? tn('{0} set is logged; the clock is still running.', '{0} sets are logged; the clock is still running.', n) : t('Nothing is logged; the clock is still running.')),
    rows: [
      { key: 'logged', title: t('Logged'), value: tn('{0} set', '{0} sets', n) },
      facts.lastSet != null && { key: 'last', title: t('Last set'), value: timeOf(facts.lastSet) },
      { key: 'open', title: t('Open for'), value: openForText(facts.openFor) },
    ].filter(Boolean),
    save: n ? tn('Save with {0} set', 'Save with {0} sets', n) : null,
    foot: n && facts.endAt != null ? t('Saving ends it at the last set, {0}, so the time stays honest.', timeOf(facts.endAt)) : null,
  }
}

/** W1.27 over Today: save it ending at the last set, continue it, or discard it (a step inside). */
export function StaleWorkoutDrawer({ close }) {
  const [step, setStep] = useState('stale')
  const st = useStore(s => s.S)
  const stale = useKept(staleFacts(st.active, Date.now()))
  const facts = useSessionFacts()
  if (!stale) return null
  const discard = () => discardNow(close, { stay: true })
  if (step === 'discard') {
    return (
      <BottomSheet type="auto" title={discardTitle(facts.discard)}>
        <DiscardStep facts={facts.discard} warmup={facts.warmup} onConfirm={discard} onCancel={() => setStep('stale')} />
      </BottomSheet>
    )
  }
  const copy = staleCopy(stale)
  const save = () => {
    const saved = saveStale()
    if (!saved) { close(); return }
    holdReopen(saved.snapshot, saved.w.id)
    closeThenNav(close, '/train/workout/summary/' + encodeURIComponent(saved.w.id))
  }
  return (
    <BottomSheet type="auto" title={copy.title}>
      <div className="g-confirm">
        <p>{copy.body}</p>
        <div>{copy.rows.map(r => <DetailRow key={r.key} title={r.title} value={r.value} />)}</div>
        {copy.save && <Button block onClick={save}>{copy.save}</Button>}
        <Button block variant="secondary" onClick={() => closeThenNav(close, '/train/workout')}>{t('Continue it')}</Button>
        <Button block variant="danger" onClick={() => askDiscard(facts.discard, close, () => setStep('discard'), { stay: true })}>{t('Discard workout')}</Button>
        {copy.foot && <p className="g-confirm-note">{copy.foot}</p>}
      </div>
    </BottomSheet>
  )
}
