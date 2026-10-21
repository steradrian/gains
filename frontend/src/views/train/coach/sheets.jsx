// The Coach page's ⋯ menu (a DS drawer holding a MenuList, board T11.0) and the light sheets it
// opens: everything the Coach proposed, comparing with others here, and automatic reviews. The
// three sheets moved from views/CoachChat.jsx unchanged; they get the new look in the app-wide
// sheet pass.
import { useEffect, useState } from 'react'
import { t, tn } from '../../../lib/i18n.js'
import { fmtDate, fmtNum } from '../../../lib/format.js'
import { emptyCoach } from '../../../lib/coach.js'
import { cohortStats, setCohortShare } from '../../../lib/coach-api.js'
import { useStore } from '../../../store/useStore.js'
import { Spacer } from '../../../components/layout.jsx'
import { EmptyState, InlineNote, LoadError } from '../../../components/blocks.jsx'
import { SheetHeader } from '../../../components/sheet-layout.jsx'
import { Loading } from '../../../components/Loader.jsx'
import { Switch, Section, Row, SelectRow } from '../../../components/ui.jsx'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import MenuList from '../../../ds/MenuList.jsx'
import { ProposalDetail, Tile } from './cards.jsx'

/** The ⋯ drawer: `items` are MenuList items, each already closing the drawer before it acts. */
export function CoachMenu({ items }) {
  return (
    <BottomSheet title={t('Coach')}>
      <MenuList items={items} label={t('Coach')} />
    </BottomSheet>
  )
}

/** Every proposal ever made, newest first. Nothing the Coach said is gone after a decision. */
export function HistorySheet({ S, close, openSheet }) {
  const log = [...(S.coach?.log || [])].reverse()
  const icon = { create: ['clipboard', 'var(--indigo)'], review: ['chat', 'var(--acc)'], debrief: ['checkCircle', 'var(--green)'], revert: ['reset', 'var(--blue)'] }
  return <div className="chat-menu">
    <SheetHeader title={t('Everything the Coach proposed')} />
    {!log.length && <EmptyState illustration="coach" title={t('Nothing yet')}
      body={t('Every plan, suggestion and debrief will be kept here, whether you said yes or no.')} />}
    <div className="sect-b">
      {log.map(e => {
        const [ic, tint] = icon[e.kind] || ['chat', 'var(--acc)']
        const n = (e.decisions || []).length
        const acc = (e.decisions || []).filter(d => d.status === 'accepted').length
        const title = e.kind === 'create' ? (e.bundle?.name || t('Coach plan')) + (e.iteration > 1 ? ` · ${t('Revision {0}', e.iteration)}` : '')
          : e.kind === 'debrief' ? t('Debrief: {0}', e.workout?.name || t('Workout')) + (e.score != null ? ` · ${e.score}/10` : '')
            : e.kind === 'revert' ? t('Reverted the last Coach changes.')
              : tn('{0} suggestion', '{0} suggestions', n)
        const sub = fmtDate(new Date(e.at).toISOString().slice(0, 10)) + ' · ' + (e.kind === 'debrief' ? String(e.summary || '').slice(0, 60)
          : e.dismissed ? t('Declined') : e.kind === 'create' ? t('Imported') : e.kind === 'revert' ? '' : t('{0} accepted · {1} declined', acc, n - acc))
        return <Row key={e.id} icon={ic} iconTint={tint} title={title} subtitle={sub} accessory="chevron"
          onClick={() => { close(); openSheet(() => <ProposalDetail entry={e} S={S} />) }} />
      })}
    </div>
    <Spacer size={5} />
  </div>
}

/**
 * How you sit against everyone else on this instance — medians only, at least three people
 * sharing, nothing that identifies anyone. The admin turns it on for the instance; each person
 * turns it on for themselves; a person who does not share sees nothing either.
 */
export function CohortSheet({ S, update, toast }) {
  const [d, setD] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => cohortStats().then(setD).catch(e => { toast(e.message || t('Could not load')); setD({ ok: false }) })
  useEffect(() => { load() }, [])
  const share = async v => {
    setBusy(true)
    try { await setCohortShare(v); update(s => { (s.coach = s.coach || emptyCoach()).share = v }); await load() }
    catch (e) { toast(e.message || t('Could not save')) }
    setBusy(false)
  }
  const sharing = !!d?.sharing
  return <div className="chat-menu">
    <SheetHeader title={t('Compare with others here')} />
    <Section footer={t('Only medians across everyone who shares, never a name, a body weight or a single session. Turning this off removes you from the numbers immediately.')}>
      <Row icon="person" iconTint="var(--teal)" title={t('Include me')} subtitle={sharing ? t('Your lifts count towards the medians') : t('Off. You see nothing and share nothing')}>
        <Switch checked={sharing} disabled={busy || !d} onChange={share} />
      </Row>
    </Section>
    {!d && <Loading />}
    {d && sharing && !d.ok && (d.people != null
      ? <EmptyState illustration="coach" title={t('Not enough people are sharing yet')}
        body={t('{0} of {1} needed. Rope in your gym mates!', d.people, d.minPeople)} />
      : <LoadError message={t('Not available right now.')} />)}
    {d && sharing && d.ok && <div className="ins cmp-ins">
      <div className="ins-tiles">
        <Tile v={d.people} l={t('People')} />
        <Tile v={fmtNum(d.sessionsPerWeek.you)} l={t('Your sessions / wk')} />
        <Tile v={fmtNum(d.sessionsPerWeek.median)} l={t('Median / wk')} />
        <Tile v={d.rankPct != null ? d.rankPct + '%' : '–'} l={t('Your strength rank')} />
      </div>
      {!!d.exercises.length && <div className="ins-block">
        <div className="ins-h"><span>{t('Estimated 1RM, you vs. median')}</span><span className="dim">{S.unit}</span></div>
        {d.exercises.map(x => {
          const max = Math.max(x.median, x.you || 0) || 1
          return <div key={x.id} className="cmp">
            <div className="cmp-h"><span>{x.name}</span><span className="dim">{x.people} {t('people')}</span></div>
            <div className="cmp-bar you"><i style={{ width: Math.round((x.you || 0) / max * 100) + '%' }} /><span>{t('You')} · {x.you != null ? fmtNum(x.you) : '–'}</span></div>
            <div className="cmp-bar"><i style={{ width: Math.round(x.median / max * 100) + '%' }} /><span>{t('Median')} · {fmtNum(x.median)}</span></div>
          </div>
        })}
      </div>}
      {!d.exercises.length && <InlineNote>{t('No exercise is trained by three or more people yet.')}</InlineNote>}
    </div>}
    <Spacer size={5} />
  </div>
}

export const cadenceLabel = coach => {
  const c = coach.cadence && coach.cadence !== 'off' ? coach.cadence : null
  if (!c) return t('Off')
  if (c.weekly) return t('Weekly')
  return t('After every few workouts')
}

export function cadenceSheet(openSheet, update) {
  openSheet(close => <CadenceSheet close={close} update={update} />)
}
function CadenceSheet({ update }) {
  const coach = useStore(s => s.S.coach) || emptyCoach()
  const cadence = coach.cadence && coach.cadence !== 'off' ? coach.cadence : null
  const mode = !cadence ? 'off' : cadence.weekly ? 'weekly' : 'every'
  const setMode = m => update(s => {
    const c = (s.coach = s.coach || emptyCoach())
    c.cadence = m === 'off' ? 'off' : m === 'weekly' ? { weekly: { day: 0, time: '18:00' } } : { everyWorkouts: 4 }
  })
  const patch = fn => update(s => { const c = (s.coach = s.coach || emptyCoach()); fn(c) })
  return <>
    <SheetHeader title={t('Automatic reviews')} />
    <Section footer={mode === 'off' ? t('Off. The Coach only looks when you ask.') : t('You are only notified when the Coach actually has something to suggest.')}>
      <SelectRow icon="clock" iconTint="var(--purple)" title={t('When')} value={mode} onChange={setMode}
        options={[
          { value: 'off', label: t('Off') },
          { value: 'weekly', label: t('Weekly'), subtitle: t('On a day and time you choose') },
          { value: 'every', label: t('After every few workouts'), subtitle: t('As soon as you have logged enough') }
        ]} />
      {mode === 'weekly' && <>
        <SelectRow icon="calendar" iconTint="var(--orange)" title={t('Day')} value={cadence.weekly.day}
          onChange={v => patch(c => { c.cadence = { weekly: { ...c.cadence.weekly, day: v } } })}
          options={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => ({ value: i, label: t(d) }))} />
        <Row icon="clock" iconTint="var(--purple)" title={t('Time')}>
          <input type="time" className="timef" value={cadence.weekly.time || '18:00'}
            onChange={e => patch(c => { c.cadence = { weekly: { ...c.cadence.weekly, time: e.target.value } } })} />
        </Row>
      </>}
      {mode === 'every' && <SelectRow icon="dumbbell" iconTint="var(--teal)" title={t('After how many workouts')}
        value={cadence.everyWorkouts || 4}
        onChange={v => patch(c => { c.cadence = { everyWorkouts: v } })}
        options={[3, 4, 5, 6, 8, 10].map(n => ({ value: n, label: tn('{0} workout', '{0} workouts', n) }))} />}
    </Section>
  </>
}
