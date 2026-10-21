// What the Coach hands over, drawn as cards: a proposed plan and a debrief (live, in the thread,
// on glass), a decided proposal folded into one line (Recap), and the whole of one as it was
// (ProposalDetail, a light sheet). The numbers under a card (Insights, DebriefBody) are computed on
// the device for the window the proposal names. Moved from views/CoachChat.jsx; the thread draws
// these inside `.tco-card`, which maps their colours onto the stage (coach-page.css).
import { useMemo, useState } from 'react'
import { t, tn } from '../../../lib/i18n.js'
import { fmtDate, fmtNum, DAYS, isoOf, weekOrder, weekStartOf } from '../../../lib/format.js'
import { exLine } from '../../../lib/history.js'
import { speedUnitOf } from '../../../lib/speed.js'
import { appendChat, applyCreatedPlan, recordDebrief, changeTitle, changeValues, exName } from '../../../lib/coach.js'
import { insightsFor, sessionInsights } from '../../../lib/coach-insights.js'
import { resolvePending } from '../../../lib/coach-api.js'
import { glyphOf } from '../../../lib/glyphs.js'
import Icon from '../../../components/Icon.jsx'
import { Spacer } from '../../../components/layout.jsx'
import { Tag } from '../../../components/blocks.jsx'
import LineChart from '../../../components/LineChart.jsx'
import Button from '../../../ds/Button.jsx'
import StageSwitch from '../../../ds/StageSwitch.jsx'
import { dismissSuggestions } from './dismiss.js'

/* ---------------------------------- the plan ---------------------------------- */

export function PlanCard({ p, S, update, toast, refresh }) {
  const b = p.bundle
  const [tab, setTab] = useState(0)
  const [schedule, setSchedule] = useState(true)
  const r = b.routines[Math.min(tab, b.routines.length - 1)]
  const weekDays = useMemo(() => new Set(Object.keys(b.week || {}).map(Number)), [b])

  const accept = () => {
    try {
      let n = 0
      update(s => {
        const res = applyCreatedPlan(s, p, { schedule })
        n = res?.routines?.length || b.routines.length
        appendChat(s, { role: 'coach', kind: 'applied', ref: res.logId, text: schedule
          ? t('Imported! {0} routines are in your plan and your week is set. See you at the next session.', n)
          : t('Imported! {0} routines are in your plan. Your week is unchanged; schedule them whenever you like.', n) })
      })
      resolvePending({ proposalId: p.id, accepted: ['plan'] }).catch(() => {})
      toast(t('Your plan is live'))
      refresh()
    } catch (e) { toast(e.message || t('That proposal can’t be read.')) }
  }
  // No confirm: the card hides at once and the toast offers Undo (owner question 7).
  const discard = () => dismissSuggestions(p, { onCommit: refresh })

  return <div className="tco-card g-glass">
    <div className="pcard">
      <div className="pcard-hd">
        <div className="pcard-eyebrow">{p.iteration > 1 ? t('Revision {0}', p.iteration) : t('Your plan')}</div>
        <h2 className="pcard-h">{b.name || t('Coach plan')}</h2>
        {!!b.summary && <p className="pcard-sum">{b.summary}</p>}
        {!!b.basedOn && <p className="pcard-sum fs-footnote">{b.basedOn}</p>}
      </div>

      <WeekStrip days={weekDays} ws={weekStartOf(S)} />

      {b.routines.length > 1 && <div className="pcard-tabs">
        {b.routines.map((x, i) => <button key={x.id || i} type="button" className={'pcard-tab' + (i === tab ? ' on' : '')} aria-pressed={i === tab} onClick={() => setTab(i)}><Icon name={glyphOf(x.emoji)} />{x.name}</button>)}
      </div>}

      {r && <RoutineBlock r={r} unit={S.unit} speedUnit={speedUnitOf(S)} />}

      <div className="pcard-row">
        <span className="lrow-m"><span className="lrow-t">{t('Use this weekly schedule')}</span><span className="lrow-s">{t('Replaces your current week. Days this plan leaves empty become rest days.')}</span></span>
        <StageSwitch label={t('Use this weekly schedule')} checked={schedule} onChange={setSchedule} />
      </div>
      <div className="pcard-note">{t('The Coach is not a doctor or a physiotherapist. If something hurts, ask a professional.')}</div>
      <div className="pcard-ft">
        <Button icon="download" onClick={accept}>{t('Import this plan')}</Button>
        <Button variant="glass" onClick={discard}>{t('Discard')}</Button>
      </div>
    </div>
    <p className="tco-foot">{t('Not quite right? Say what to change below and I will revise the whole plan.')}</p>
  </div>
}

// In the order the week is set to start on (Settings), like the Plan's own week.
export const WeekStrip = ({ days, ws }) => <div className="pcard-week">
  {weekOrder(ws).map(d => <div key={d} className={'pcard-wd' + (days.has(d) ? ' on' : '')}>{t(DAYS[d])}</div>)}
</div>

export const RoutineBlock = ({ r, unit, speedUnit }) => <div className="pcard-rt">
  <div className="pcard-rt-h"><b><Icon name={glyphOf(r.emoji)} />{r.name}</b><span>{tn('{0} exercise', '{0} exercises', r.ex.length)}</span></div>
  {!!r.why && <div className="pcard-why">{r.why}</div>}
  {r.ex.map((e, i) => <div key={i} className="pcard-ex">
    <div className="pcard-ex-r"><span className="pcard-ex-n">{exName(e.id)}</span><span className="pcard-ex-l">{exLine(e, unit, speedUnit)}</span></div>
    {!!e.why && <div className="pcard-ex-w">{e.why}</div>}
  </div>)}
</div>

/* ---------------------------------- a change ---------------------------------- */

export function ChangeRow({ c, S, stale, badge, children }) {
  const vals = changeValues(c, S)
  return <div className={'pcard-chg' + (stale ? ' stale' : '') + (c.status === 'rejected' ? ' declined' : '')}>
    <div className="grow">
      <div className="pcard-chg-t">{changeTitle(c, S)}{c.routineName ? <span className="dim fw-regular"> · {c.routineName}</span> : null}</div>
      {vals && <div className="pcard-chg-v"><Tag>{vals.before}</Tag><Icon name="chevronRight" className="fs-caption dim" /><Tag tone="acc">{vals.after}</Tag></div>}
      <div className="pcard-chg-w">{c.why}</div>
      {stale && <div className="pcard-chg-stale">{t('Doesn’t match your plan any more, so it can’t be applied.')}</div>}
    </div>
    {badge}
    {children}
  </div>
}

export const Notes = ({ notes }) => !!notes?.length && <div className="pcard-notes">
  {notes.map((n, i) => <div key={i}><Icon name="lightbulb" />{n}</div>)}
</div>

/* ---------------------------------- insights ---------------------------------- */

const BP_LABEL = { back: 'Back muscles', cardio: 'Cardio', chest: 'Chest', 'lower arms': 'Forearms', 'lower legs': 'Calves', neck: 'Neck', shoulders: 'Shoulders', 'upper arms': 'Arms', 'upper legs': 'Legs', waist: 'Core', other: 'Other' }
const bpLabel = bp => t(BP_LABEL[bp] || bp)

/**
 * The numbers the Coach read, drawn: how much and how often, where the body weight went,
 * which lifts moved, which body parts got the work. Computed on the device for the window the
 * proposal names, so the picture under a suggestion is the evidence behind it, not decoration.
 */
export function Insights({ S, window: win, compact }) {
  const ins = useMemo(() => insightsFor(S, win || {}), [S, win?.from, win?.to])
  if (!ins.sessions && !ins.bodyweight.points.length) return null
  const maxBp = ins.bodyParts[0]?.sets || 1
  const bw = ins.bodyweight
  return <div className="ins">
    <div className="ins-tiles">
      <Tile v={ins.sessions} l={t('Sessions')} />
      <Tile v={ins.minutes != null ? ins.minutes : '–'} l={t('Min / session')} />
      <Tile v={ins.volume ? kfmt(ins.volume) : '–'} l={t('Volume ({0})', S.unit)} />
      <Tile v={ins.sets} l={t('Sets')} />
    </div>

    {bw.points.length > 1 && <div className="ins-block">
      <div className="ins-h">
        <span>{t('Body weight')}</span>
        <span className={'ins-delta' + (bw.delta > 0 ? ' up' : bw.delta < 0 ? ' down' : '')}>
          {bw.delta > 0 ? '+' : ''}{fmtNum(bw.delta)} {S.unit}{bw.goal != null ? ` · ${t('goal')} ${fmtNum(bw.goal)}` : ''}
        </span>
      </div>
      <div className="chart"><LineChart points={bw.points} h={compact ? 96 : 120} unit={S.unit} goal={bw.goal} axes={!compact} label={t('Body weight')} /></div>
    </div>}

    {!!ins.strength.length && <div className="ins-block">
      <div className="ins-h"><span>{t('Estimated 1RM')}</span><span className="dim">{t('first → last session')}</span></div>
      {ins.strength.map(x => <div key={x.id} className="ins-row">
        <span className="ins-row-n">{x.name}</span>
        <span className="ins-row-v"><Tag>{fmtNum(x.first)}</Tag><Icon name="chevronRight" /><Tag tone="acc">{fmtNum(x.last)}</Tag></span>
        <span className={'ins-delta' + (x.delta > 0 ? ' up' : x.delta < 0 ? ' down' : '')}>{x.delta > 0 ? '▲' : x.delta < 0 ? '▼' : '•'} {Math.abs(x.pct)}%</span>
      </div>)}
    </div>}

    {!!ins.bodyParts.length && !compact && <div className="ins-block">
      <div className="ins-h"><span>{t('Work sets by body part')}</span></div>
      {ins.bodyParts.slice(0, 6).map(b => <div key={b.bp} className="ins-bar">
        <span className="ins-bar-l">{bpLabel(b.bp)}</span>
        <span className="ins-bar-t"><i style={{ width: Math.max(4, Math.round(b.sets / maxBp * 100)) + '%' }} /></span>
        <span className="ins-bar-v">{b.sets}</span>
      </div>)}
    </div>}
  </div>
}
export const Tile = ({ v, l }) => <div className="ins-tile"><div className="ins-tile-v">{v}</div><div className="ins-tile-l">{l}</div></div>
const kfmt = n => (n >= 10000 ? Math.round(n / 1000) + 'k' : fmtNum(n))

/* ---------------------------------- a debrief ---------------------------------- */

function DebriefBody({ p, S }) {
  const w = p.workout || {}
  const live = useMemo(() => sessionInsights(S, (S.workouts || []).find(x => x.id === w.id) || null), [S, w.id])
  const score = Number.isFinite(p.score) ? Math.max(1, Math.min(10, p.score)) : null
  return <>
    {score != null && <div className="deb-score">
      <div className="deb-ring" style={{ '--pct': score / 10 }}><span>{score}</span><small>/10</small></div>
      <div className="deb-score-t"><b>{scoreWord(score)}</b><span>{w.name || t('Workout')}{w.d ? ' · ' + fmtDate(w.d) : ''}</span></div>
    </div>}
    {live && <div className="ins">
      <div className="ins-tiles">
        <Tile v={live.now.sets} l={t('Sets')} />
        <Tile v={live.now.minutes != null ? live.now.minutes : '–'} l={t('Minutes')} />
        <Tile v={live.now.volume ? kfmt(live.now.volume) : '–'} l={t('Volume ({0})', S.unit)} />
        <Tile v={live.now.prs || '–'} l={t('PRs')} />
      </div>
      {live.then && <div className="ins-cmp">
        {t('vs. last {0} on {1}:', w.name || t('session'), fmtDate(live.prevDate))}{' '}
        <Delta v={live.now.volume - live.then.volume} unit={S.unit} label={t('volume')} />
        {live.now.minutes != null && live.then.minutes != null && <Delta v={live.now.minutes - live.then.minutes} unit="min" label={t('time')} />}
      </div>}
      {!!live.lifts.length && <div className="ins-block">
        <div className="ins-h"><span>{t('Best set, estimated 1RM')}</span></div>
        {live.lifts.slice(0, 6).map(x => <div key={x.id} className="ins-row">
          <span className="ins-row-n">{x.name} <span className="dim">{fmtNum(x.w)}×{x.r}</span></span>
          <span className="ins-row-v"><Tag tone="acc">{fmtNum(x.est)}</Tag></span>
          {x.prev != null && <span className={'ins-delta' + (x.est > x.prev ? ' up' : x.est < x.prev ? ' down' : '')}>{x.est > x.prev ? '▲' : x.est < x.prev ? '▼' : '•'} {fmtNum(Math.abs(x.est - x.prev))}</span>}
        </div>)}
      </div>}
    </div>}
    <DebriefList icon="checkCircle" tone="good" title={t('What went well')} items={p.highlights} />
    <DebriefList icon="warning" tone="warn" title={t('Worth watching')} items={p.watch} />
    <DebriefList icon="arrowUp" tone="next" title={t('Next time')} items={p.nextTime} />
  </>
}
const Delta = ({ v, unit, label }) => <span className={'ins-delta' + (v > 0 ? ' up' : v < 0 ? ' down' : '')}>{v > 0 ? '+' : ''}{fmtNum(v)} {unit} {label}</span>
const DebriefList = ({ icon, tone, title, items }) => !!items?.length && <div className="deb-list">
  <div className={'deb-list-h deb-' + tone}><Icon name={icon} />{title}</div>
  {items.map((x, i) => <div key={i} className="deb-item">{x}</div>)}
</div>
const scoreWord = s => s >= 9 ? t('Excellent session') : s >= 7 ? t('Good session') : s >= 5 ? t('Solid session') : t('Tough session')

export function DebriefCard({ p, S, update, toast, refresh }) {
  const done = () => {
    update(s => { const ref = recordDebrief(s, p); appendChat(s, { role: 'coach', kind: 'debrief', ref, text: '' }) })
    resolvePending({ proposalId: p.id, accepted: ['debrief'] }).catch(() => {})
    toast(t('Kept in your Coach history'))
    refresh()
  }
  return <div className="tco-card g-glass">
    <div className="pcard">
      <div className="pcard-hd">
        <div className="pcard-eyebrow">{t('Workout debrief')}</div>
        <h2 className="pcard-h">{p.workout?.name || t('Your last workout')}</h2>
        {!!p.summary && <p className="pcard-sum">{p.summary}</p>}
      </div>
      <DebriefBody p={p} S={S} />
      <div className="pcard-ft">
        <Button icon="check" onClick={done}>{t('Got it')}</Button>
      </div>
    </div>
    <p className="tco-foot">{t('Want changes to the plan from this? Ask for a review below.')}</p>
  </div>
}

/* ---------------------------------- what was decided ---------------------------------- */

/** A decided proposal, folded: one line of what it was and what you did, and a way back in. */
export function Recap({ entry, S, openSheet }) {
  const open = () => openSheet(() => <ProposalDetail entry={entry} S={S} />)
  const decisions = entry.decisions || []
  const acc = decisions.filter(d => d.status === 'accepted').length
  const rej = decisions.length - acc
  const kind = entry.kind
  const eyebrow = kind === 'create' ? t('Plan') : kind === 'debrief' ? t('Workout debrief') : t('Suggestions')
  const state = kind === 'debrief' ? null
    : entry.dismissed ? { cls: 'no', text: t('Declined') }
      : kind === 'create' ? { cls: 'yes', text: t('Imported') }
        : rej ? { cls: 'mix', text: t('{0} accepted · {1} declined', acc, rej) } : { cls: 'yes', text: t('{0} accepted', acc) }
  const title = kind === 'create' ? (entry.bundle?.name || t('Coach plan'))
    : kind === 'debrief' ? (entry.workout?.name || t('Workout')) + (entry.score != null ? ` · ${entry.score}/10` : '')
      : tn('{0} suggestion', '{0} suggestions', decisions.length)
  return <button type="button" className="recap" onClick={open}>
    <div className="recap-top">
      <span className="pcard-eyebrow">{eyebrow}</span>
      {state && <span className={'recap-state ' + state.cls}>{state.text}</span>}
    </div>
    <div className="recap-t">{title}</div>
    {!!entry.summary && <div className="recap-s">{entry.summary}</div>}
    {kind === 'review' && !!decisions.length && <div className="recap-chips">
      {decisions.slice(0, 4).map(d => <span key={d.id} className={'recap-chip ' + (d.status === 'accepted' ? 'yes' : 'no')}><Icon name={d.status === 'accepted' ? 'check' : 'xmark'} />{changeTitle(d, S)}</span>)}
      {decisions.length > 4 && <span className="recap-chip">+{decisions.length - 4}</span>}
    </div>}
    <div className="recap-more">{t('Show everything')}<Icon name="chevronRight" /></div>
  </button>
}

/** The whole proposal, as it was, read-only (a light sheet). */
export function ProposalDetail({ entry, S }) {
  const [tab, setTab] = useState(0)
  const kind = entry.kind
  const b = entry.bundle
  const r = b?.routines?.[Math.min(tab, (b?.routines?.length || 1) - 1)]
  const weekDays = useMemo(() => new Set(Object.keys(b?.week || {}).map(Number)), [b])
  return <div className="pdetail">
    <div className="pcard-hd">
      <div className="pcard-eyebrow">{kind === 'create' ? t('Plan') : kind === 'debrief' ? t('Workout debrief') : t('Suggestions')} · {fmtDate(isoOf(new Date(entry.at)))}</div>
      <h2 className="pcard-h">{kind === 'create' ? (b?.name || t('Coach plan')) : kind === 'debrief' ? (entry.workout?.name || t('Workout')) : tn('{0} suggestion', '{0} suggestions', entry.decisions?.length || 0)}</h2>
      {!!entry.summary && <p className="pcard-sum">{entry.summary}</p>}
      {entry.dismissed && <p className="pcard-sum ink-danger">{t('You declined this.')}</p>}
      {!!entry.evidence?.sessions && <p className="pcard-sum fs-footnote">
        {t('Based on your last {0} sessions', entry.evidence.sessions)}{entry.evidence.from ? ` · ${fmtDate(entry.evidence.from)} – ${fmtDate(entry.evidence.to)}` : ''}
      </p>}
    </div>

    {kind === 'review' && <>
      <Insights S={S} window={entry.evidence} />
      {(entry.decisions || []).map(d => <ChangeRow key={d.id} c={d} S={S} stale={d.status === 'stale'}
        badge={<span className={'recap-state ' + (d.status === 'accepted' ? 'yes' : 'no')}>{d.status === 'accepted' ? t('Accepted') : d.status === 'stale' ? t('Expired') : t('Declined')}</span>} />)}
      <Notes notes={entry.notes} />
    </>}

    {kind === 'create' && b && <>
      <WeekStrip days={weekDays} ws={weekStartOf(S)} />
      {b.routines.length > 1 && <div className="pcard-tabs">
        {b.routines.map((x, i) => <button key={x.id || i} type="button" className={'pcard-tab' + (i === tab ? ' on' : '')} aria-pressed={i === tab} onClick={() => setTab(i)}><Icon name={glyphOf(x.emoji)} />{x.name}</button>)}
      </div>}
      {r && <RoutineBlock r={r} unit={S.unit} speedUnit={speedUnitOf(S)} />}
      <p className="pcard-sum fs-footnote">{entry.scheduled ? t('Your week was set to this schedule.') : t('Imported without changing your week.')}</p>
    </>}
    {kind === 'create' && !b && <p className="pcard-sum">{t('This plan was imported before the app kept proposals; only its summary is left.')}</p>}

    {kind === 'debrief' && <DebriefBody p={entry} S={S} />}
    {kind === 'revert' && <p className="pcard-sum">{t('Reverted the last Coach changes.')}</p>}
    <Spacer size={5} />
  </div>
}
