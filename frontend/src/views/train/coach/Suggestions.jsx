import { useId, useMemo, useState } from 'react'
import { t, tn } from '../../../lib/i18n.js'
import { fmtDate } from '../../../lib/format.js'
import { cx } from '../../../lib/ui-kit.js'
import { appendChat, applicable, applyChangeSet, changeTitle, changeValues, markStale } from '../../../lib/coach.js'
import { resolvePending } from '../../../lib/coach-api.js'
import Icon from '../../../components/Icon.jsx'
import Button from '../../../ds/Button.jsx'
import { Insights, Notes } from './cards.jsx'
import { dismissSuggestions } from './dismiss.js'

// "Suggested this week · You decide" (T11.0): the pending review's changes as glass rows, each a
// toggle (all on to begin with; one turned off is drawn off and announced unchecked). A change that
// no longer matches the plan keeps its badge and cannot be picked. Apply all, or "Apply {0}" when
// some are off, applies the picked ones (applyChangeSet); Dismiss hides them with Undo (T11.3).
export default function Suggestions({ p, S, update, toast, refresh }) {
  const headId = useId()
  const marked = useMemo(() => markStale(p, S), [p, S])
  const usable = applicable(marked)
  const [accepted, setAccepted] = useState(() => new Set(usable.map(c => c.id)))
  const toggle = id => setAccepted(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const ids = usable.filter(c => accepted.has(c.id)).map(c => c.id)

  const apply = () => {
    if (!ids.length) return
    try {
      update(s => {
        const res = applyChangeSet(s, marked, ids)
        appendChat(s, { role: 'coach', kind: 'applied', ref: res.logId, text: tn('Applied {0} change to your plan.', 'Applied {0} changes to your plan.', ids.length) })
      })
      resolvePending({ proposalId: marked.id, accepted: ids, rejected: marked.changes.filter(c => !ids.includes(c.id)).map(c => c.id) }).catch(() => {})
      toast(tn('{0} change applied', '{0} changes applied', ids.length))
      refresh()
    } catch (e) { toast(e.message || t('Could not apply those changes')) }
  }
  const dismiss = () => dismissSuggestions(marked, { onCommit: refresh })

  return (
    <section className="tco-sugg" aria-labelledby={headId}>
      <div className="g-ssec">
        <h2 id={headId}>{t('Suggested this week')}</h2>
        <span className="g-ssec-act">{t('You decide')}</span>
      </div>
      {!!marked.summary && <p className="tco-lead">{marked.summary}</p>}
      {!!marked.evidence?.sessions && <p className="tco-meta">
        {t('Based on your last {0} sessions', marked.evidence.sessions)}{marked.evidence.from ? ` · ${fmtDate(marked.evidence.from)} – ${fmtDate(marked.evidence.to)}` : ''}
      </p>}
      {marked.planMoved && <p className="tco-meta tco-warn">
        {t('Your plan changed since the Coach looked at it. Suggestions that no longer match are greyed out. Ask for a fresh review to see them again.')}
      </p>}

      <div className="tco-rows g-glass">
        {marked.changes.map(c => <ChangeToggle key={c.id} c={c} S={S} on={accepted.has(c.id)} onToggle={() => toggle(c.id)} />)}
      </div>

      <div className="tco-acts">
        <Button variant="glass" onClick={dismiss}>{t('Dismiss')}</Button>
        <Button haptic onClick={apply} disabled={!ids.length}>{ids.length === usable.length ? t('Apply all') : t('Apply {0}', ids.length)}</Button>
      </div>

      {(!!marked.notes?.length || !!marked.evidence) && <div className="tco-card g-glass">
        <Insights S={S} window={marked.evidence} />
        <Notes notes={marked.notes} />
      </div>}
      <p className="tco-meta">{t('The Coach is not a doctor or a physiotherapist. If something hurts, ask a professional.')}</p>
    </section>
  )
}

// One change: a toggle row, or, when it no longer matches the plan, a row that says so.
function ChangeToggle({ c, S, on, onToggle }) {
  const vals = changeValues(c, S)
  const stale = c.status === 'stale'
  const body = <span className="tco-chg-body">
    <b>{changeTitle(c, S)}{c.routineName ? <span className="tco-chg-dim"> · {c.routineName}</span> : null}</b>
    {vals && <span className="tco-chg-v">{vals.before}<Icon name="chevronRight" className="g-icon" />{vals.after}</span>}
    {!!c.why && <span>{c.why}</span>}
    {stale && <span className="tco-chg-stale">{t('Doesn’t match your plan any more, so it can’t be applied.')}</span>}
    {!stale && !on && <span className="tco-chg-off">{t('Not applied')}</span>}
  </span>
  if (stale) return <div className="tco-chg stale">{body}</div>
  return (
    <button type="button" role="checkbox" aria-checked={on} className={cx('tco-chg', !on && 'off')} onClick={onToggle}>
      {body}
      <span className="tco-chg-mark" aria-hidden="true">{on && <Icon name="check" className="g-icon" />}</span>
    </button>
  )
}
