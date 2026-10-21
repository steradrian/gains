// The Coach page (T11.0, /train/coach, only with Coach on), on the stage.
//
// Top to bottom: this week's suggestions when a review is pending (views/train/coach/Suggestions,
// each change a toggle, Dismiss with Undo, Apply all), the weekly Check in (T11.1), then the chat:
// your answers as the opening message, a typing bubble while a job runs (with how long it usually
// takes), a proposed plan or a debrief as a glass card, every decided proposal folded into a card
// that opens it whole, and the composer. The ⋯ holds what the old header menu held.
//
// The thread is `S.coach.chat` (small, synced) plus whatever is live right now from the status
// poll: a running job or a pending proposal. Nothing about the proposal is copied into the chat
// until a decision is made about it, so two devices can never disagree on what is pending. Once
// decided, the chat line carries a `ref` into `S.coach.log`, where the whole proposal is kept, so
// saying yes or no never makes it disappear. Turning the Coach off is the admin's decision, not a
// control on this screen: with it off the page sends you to Train.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { closeThenNav } from '../lib/nav.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { fmtDate, isoOf } from '../lib/format.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import {
  coachAvailable, hasConsent, emptyCoach, appendChat, recordTiming, estimateMs, profileLines,
  logEntry, canRevert, revertLast
} from '../lib/coach.js'
import { checkInFor } from '../lib/coach-checkin.js'
import { useDismissPending } from '../lib/coach-dismiss.js'
import { useCoachStatus, requestReview, requestDebrief, requestPlan, refinePlan, jobErrorText, awaitedJob, settleAwaited, JOB_ERRORS } from '../lib/coach-api.js'
import { confirmSheet } from '../sheets.jsx'
import { glyphOf } from '../lib/glyphs.js'
import Icon from '../components/Icon.jsx'
import { Spacer } from '../components/layout.jsx'
import { EmptyState } from '../components/blocks.jsx'
import { SheetHeader } from '../components/sheet-layout.jsx'
import { Row } from '../components/ui.jsx'
import ChatBubble from '../ds/ChatBubble.jsx'
import StagePage from '../ds/StagePage.jsx'
import StageSection from '../ds/StageSection.jsx'
import '../coach.css'
import './train/coach/coach-page.css'
import { DebriefCard, PlanCard, Recap } from './train/coach/cards.jsx'
import { checkInSheet } from './train/coach/CheckInDrawer.jsx'
import { CoachMenu, CohortSheet, HistorySheet, cadenceLabel, cadenceSheet } from './train/coach/sheets.jsx'
import Suggestions from './train/coach/Suggestions.jsx'

export default function CoachChat() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const coachLocal = useStore(s => s.coachLocal)
  const update = useStore(s => s.update)
  const storeReady = useStore(s => s.ready)
  const toast = useUI(s => s.toast)
  const openSheet = useUI(s => s.openSheet)
  const coachMode = coachLocal?.mode
  const ok = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  const { job, pending, cap, loading, lastError, last, refresh, maxMessageLen } = useCoachStatus(ok)
  const hiding = useDismissPending(pending?.id)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef(null)
  const prevJob = useRef(null)

  // Whether Coach is on is known once the server's config has loaded (the demo and a phone with
  // its own key know without it). A deep link opened cold must not be bounced while it is unknown.
  const known = config != null || DEMO || (MOBILE && coachMode === 'byok')
  const ready = ok && hasConsent(S) && !!S.coach?.profile
  // Not before the store has loaded either: a cold start straight on #/train/coach would otherwise
  // read an empty state, decide there is no consent, and bounce a consenting user into the intake.
  useEffect(() => {
    if (!storeReady || !known) return
    if (!ok) nav('/train', { replace: true })
    else if (!ready) nav('/train/coach/intake', { replace: true })
  }, [storeReady, known, ok, ready])

  // A job that ends is either a proposal, "nothing to change", or a failure. The server tells
  // the client none of that directly — the job simply stops appearing — so the transition is
  // read here, once, and written into the thread as the Coach's reply. Two ways to see it end:
  // the job was seen running and is now gone, or the run this app started (its id came back
  // from the start request) is already the server's last outcome — a provider that refuses the
  // connection fails the run before the first status poll, and it is never seen running at all.
  useEffect(() => {
    if (loading) return
    const was = prevJob.current
    prevJob.current = job
    if (job) return
    const mine = awaitedJob()
    const endedUnseen = !was && !!mine && last?.id === mine
    if (!was && !endedUnseen) return
    settleAwaited(was ? was.id : mine)
    const ms = was?.startedAt ? Date.now() - was.startedAt : 0
    update(s => {
      // A run that ended unseen has no duration worth learning from.
      if (was) recordTiming(s, ms)
      if (!pending) {
        const cls = lastError?.errorClass || (last?.outcome === 'failed' ? (last.errorClass || 'internal') : null)
        appendChat(s, cls
          ? { role: 'coach', kind: 'error', text: jobErrorText(cls, lastError?.detail) }
          : { role: 'coach', kind: 'nochange', text: last?.reading
            ? last.reading
            : t('I looked through everything and there is nothing I would change right now. Keep it up, and ask me again after a few more sessions.') })
      }
    })
  }, [job, pending, loading, last?.id])

  useEffect(() => { if (typeof endRef.current?.scrollIntoView === 'function') endRef.current.scrollIntoView({ block: 'end' }) }, [S.coach?.chat?.length, !!job, !!pending])

  if (!ready) return null
  const coach = S.coach || emptyCoach()
  const community = !!config?.coach?.community && !DEMO && !(MOBILE && coachMode === 'byok')

  const send = async () => {
    const msg = text.trim()
    if (!msg || busy || hiding) return
    setBusy(true)
    try {
      // A message about a proposed plan refines it. With no plan at all — the first attempt
      // failed, or nothing was ever built — the message asks for one; a review would only
      // answer that there is no workout to look at, which is how people got stuck.
      if (pending?.kind === 'create' || !(S.routines || []).length) await refinePlan(msg)
      else await requestReview(msg)
      update(s => appendChat(s, { role: 'user', kind: 'text', text: msg }))
      setText('')
      refresh()
    } catch (e) {
      // A server that refuses the job says so in English, with its class beside it: the class
      // picks the translated line. One with no line here ('shared') keeps the server's words.
      toast(JOB_ERRORS[e.data?.code] || e.message || t('Could not ask the Coach'))
    }
    setBusy(false)
  }

  // While a Dismiss waits out its Undo window nothing new is asked for: the proposal it would
  // bring could land before the dismissal is sent (review #5). The chips and the menu's asks
  // already wait for `idle`; the composer is held below.
  const ask = async (fn, line) => {
    if (hiding) return
    setBusy(true)
    try {
      await fn()
      update(s => appendChat(s, { role: 'user', kind: 'text', text: line }))
      refresh()
    } catch (e) { toast(JOB_ERRORS[e.data?.code] || e.message || t('Could not ask the Coach')) }
    setBusy(false)
  }
  const askReview = () => ask(() => requestReview(''), t('Have a look at my training and tell me what you would change.'))
  const lastWorkout = (S.workouts || []).filter(w => w && w.d).at(-1) || null
  const askDebrief = () => ask(() => requestDebrief(lastWorkout?.id || null), lastWorkout?.name
    ? t('How did my {0} session go?', lastWorkout.name)
    : t('How did my last workout go?'))
  const askNewPlan = () => ask(() => requestPlan(coach.profile), t('Build me a fresh plan from my answers.'))
  const askImprove = r => ask(
    () => requestReview(t('Focus only on my routine “{0}”. Improve it: exercise choice, order, sets and reps, rep ranges, progression. Leave the other routines alone.', r.name)),
    t('Improve my routine “{0}”.', r.name))

  const pickRoutine = () => openSheet(close => <div className="chat-menu">
    <SheetHeader title={t('Improve which routine?')} />
    <div className="sect-b">
      {(S.routines || []).map(r => <Row key={r.id} icon={glyphOf(r.emoji)} iconTint="var(--acc)" title={r.name} subtitle={tn('{0} exercise', '{0} exercises', (r.ex || []).length)} accessory="chevron" onClick={() => { close(); askImprove(r) }} />)}
      {!(S.routines || []).length && <EmptyState illustration="routine" title={t('No routines yet')} body={t('Ask the Coach for a plan first.')} />}
    </div>
    <Spacer size={5} />
  </div>)

  const showHistory = () => openSheet(close => <HistorySheet S={S} close={close} openSheet={openSheet} />)
  const showCohort = () => openSheet(() => <CohortSheet S={S} update={update} toast={toast} />)

  const doRevert = () => confirmSheet({
    title: t('Undo the last Coach changes?'),
    message: t('Your plan goes back to how it was before you accepted them. Workouts you have logged since are untouched.'),
    confirmText: t('Undo'),
    onConfirm: () => {
      let done = false
      update(s => { done = revertLast(s); if (done) appendChat(s, { role: 'coach', kind: 'reverted', text: t('Done! Your plan is back to how it was before my last changes.') }) })
      toast(done ? t('Plan restored') : t('Nothing to undo'))
    }
  })

  const idle = !job && !pending
  const menu = () => openSheet(close => {
    const then = fn => () => { close(); fn() }
    const items = [
      idle && { key: 'review', icon: 'chat', label: t('Ask for a review'), detail: t('What would the Coach change after your last sessions?'), onClick: then(askReview) },
      idle && !!lastWorkout && { key: 'debrief', icon: 'checkCircle', label: t('Review my last workout'), detail: t('What went well, what to watch, what to do next time'), onClick: then(askDebrief) },
      idle && !!(S.routines || []).length && { key: 'improve', icon: 'wrench', label: t('Improve a routine'), detail: t('Pick one; the Coach works on just that'), onClick: then(pickRoutine) },
      community && { key: 'cohort', icon: 'person', label: t('Compare with others here'), detail: t('Anonymous medians from this instance'), onClick: then(showCohort) },
      { key: 'history', icon: 'history', label: t('Everything the Coach proposed'), detail: t('Plans, suggestions and debriefs, kept'), onClick: then(showHistory) },
      idle && { key: 'plan', icon: 'clipboard', label: t('Start a new plan'), detail: t('A fresh plan from your answers; your workouts stay'), onClick: then(askNewPlan) },
      { key: 'intake', icon: 'pencil', label: t('Edit my answers'), detail: t('Goal, days, equipment, limits'), onClick: () => closeThenNav(close, '/train/coach/intake?edit=1') },
      { key: 'cadence', icon: 'clock', label: t('Automatic reviews'), detail: cadenceLabel(coach), onClick: then(() => cadenceSheet(openSheet, update)) },
      canRevert(S) && { key: 'revert', icon: 'reset', label: t('Undo the last Coach changes'), onClick: then(doRevert) },
    ].filter(Boolean)
    return <CoachMenu items={items} />
  }, { variant: 'ds' })

  const checkedIn = !!checkInFor(S)
  const placeholder = pending?.kind === 'create'
    ? t('What should change?')
    : job ? t('Coach is thinking…') : t('Message the Coach…')
  const live = pending && !job && !hiding ? pending : null

  return <StagePage largeTitle={t('Coach')} sub={t('Plan design and reviews, from your own training')}
    actions={[{ icon: 'more', label: t('More'), onClick: menu }]}>
    <div className="tco">
      {live?.kind === 'review' && <Suggestions key={live.id} p={live} S={S} update={update} toast={toast} refresh={refresh} />}

      <button type="button" className={'tco-checkin g-glass' + (checkedIn ? ' done' : '')} onClick={checkInSheet}>
        <Icon name={checkedIn ? 'checkCircle' : 'note'} className="g-icon" />{checkedIn ? t('Checked in') : t('Check in')}
      </button>

      <StageSection title={t('Chat')} />
      <div className="tco-thread">
        <ChatBubble who={t('Coach')} text={t('Hi, I’m your Coach. I build your plan from your answers and adjust it from what you actually log. Nothing changes until you say so.')} />

        {(coach.chat || []).map(m => <Message key={m.id} m={m} S={S} profile={coach.profile} openSheet={openSheet} />)}

        {job && <Typing S={S} kind={job.kind} coachLocal={coachLocal} config={config} />}

        {live?.kind === 'create' && <PlanCard p={live} S={S} update={update} toast={toast} refresh={refresh} />}
        {live?.kind === 'debrief' && <DebriefCard p={live} S={S} update={update} toast={toast} refresh={refresh} />}

        <div ref={endRef} />
      </div>
    </div>

    <div className="tco-composer">
      {idle && !busy && <div className="tco-chips">
        <button type="button" className="tco-chip g-glass" onClick={askReview}><Icon name="chat" className="g-icon" />{t('Review my training')}</button>
        {!!lastWorkout && <button type="button" className="tco-chip g-glass" onClick={askDebrief}><Icon name="checkCircle" className="g-icon" />{t('Last workout')}</button>}
        {!!(S.routines || []).length && <button type="button" className="tco-chip g-glass" onClick={pickRoutine}><Icon name="wrench" className="g-icon" />{t('Improve a routine')}</button>}
        {community && <button type="button" className="tco-chip g-glass" onClick={showCohort}><Icon name="person" className="g-icon" />{t('Compare')}</button>}
      </div>}
      <div className="tco-composer-in">
        <textarea rows={1} value={text} maxLength={maxMessageLen || 1000} placeholder={placeholder} disabled={!!job || hiding}
          aria-label={t('Message the Coach…')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button type="button" className="tco-send" onClick={send} disabled={!text.trim() || busy || !!job || hiding} aria-label={t('Send')}><Icon name="arrowUp" className="g-icon" /></button>
      </div>
      {cap?.limit > 0 && <div className="tco-cap">{t('{0} of {1} Coach runs used today', cap.used, cap.limit)}</div>}
    </div>
  </StagePage>
}

/* ---------------------------------- the thread ---------------------------------- */

function Message({ m, S, profile, openSheet }) {
  const me = m.role === 'user'
  const who = me ? t('You') : t('Coach')
  const time = m.at ? stamp(m.at) : undefined
  if (m.kind === 'intake') {
    const lines = profileLines(profile)
    return <ChatBubble me who={who} time={time}>
      <span>{t('Here is what I am working with:')}</span>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
    </ChatBubble>
  }
  if (m.kind === 'applied' || m.kind === 'dismissed' || m.kind === 'debrief') {
    const entry = m.ref ? logEntry(S, m.ref) : null
    return <>
      {!!m.text && <ChatBubble who={who} time={entry ? undefined : time} text={m.text} />}
      {entry && <div className="tco-card g-glass"><Recap entry={entry} S={S} openSheet={openSheet} /></div>}
      {entry && time && <p className="tco-foot">{time}</p>}
    </>
  }
  if (m.kind === 'reverted' || m.kind === 'nochange' || m.kind === 'error' || m.kind === 'text') {
    return <ChatBubble me={me} who={who} time={time} error={m.kind === 'error'} text={m.text} />
  }
  return null
}

const stamp = at => {
  const d = new Date(at)
  const today = new Date()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === today.toDateString() ? time : fmtDate(isoOf(d)) + ' · ' + time
}

function Typing({ S, kind, coachLocal, config }) {
  const ms = estimateMs(S)
  // "Local" on either side: the phone's own OpenAI-compatible endpoint, or the server's —
  // /api/config names the provider, and a model on the owner's box is nothing like a cloud API.
  const local = (coachLocal?.mode === 'byok' && coachLocal?.provider === 'compatible') || config?.coach?.provider === 'compatible'
  let eta
  if (ms) {
    const min = Math.round(ms / 60000)
    eta = min < 1 ? t('Usually under a minute.') : t('Usually about {0} min.', min)
  } else {
    // Until a job has been measured, "a minute or two" is a cloud number — say nothing for a
    // local model rather than something wrong; the next line already warns it takes longer.
    eta = local ? '' : t('This usually takes a minute or two.')
  }
  const doing = kind === 'create' ? t('Building your plan…') : kind === 'debrief' ? t('Looking at that session…') : t('Reading your training…')
  return <>
    <ChatBubble who={t('Coach is thinking…')}><span className="tco-typing" aria-hidden="true"><i /><i /><i /></span></ChatBubble>
    <p className="tco-eta" role="status">
      {doing} {eta}
      {local ? ' ' + t('A local model can take longer.') : ''}
      {' ' + t('Feel free to leave, it keeps going.')}
    </p>
  </>
}
