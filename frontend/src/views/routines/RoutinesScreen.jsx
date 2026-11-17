import { useState } from 'react'
import ExerciseStillImg from '../../components/ExerciseStillImg.jsx'
import Icon from '../../components/Icon.jsx'
import SwipeRow from '../../components/SwipeRow.jsx'
import Act from '../../ds/Act.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import { t } from '../../lib/i18n.js'
import { useListReorder } from '../../lib/use-list-reorder.js'
import { useRoutines } from './use-routines.js'

// The flash a row lands with when a swipe brought it (a duplicate): one per new value.
let flashSeq = 0

// A routine's exercise pictures, overlapping (board T4.0); a slot with no picture is a dumbbell tile.
function Thumbs({ stills }) {
  return (
    <span className="g-rt-stack" aria-hidden="true">
      {(stills.length ? stills : [null]).map((id, i) => <span key={i}><ExerciseStillImg id={id} size="40" /></span>)}
    </span>
  )
}

function RoutineRow({ row, onClick }) {
  return (
    <Act onClick={onClick} className="g-glist-row g-rt-row">
      <Thumbs stills={row.stills} />
      <span className="g-glist-body"><b>{row.name}</b>{row.sub && <span>{row.sub}</span>}</span>
      <Icon name="chevronRight" className="g-icon g-glist-chev" />
    </Act>
  )
}

// Reorder (owner question 6): one flat list in `S.routines` order, each row with move up and
// down (the keyboard's way) and a handle to drag, which also moves with the arrow keys.
function ReorderList({ rows, move }) {
  const reorder = useListReorder(rows.length, move)
  // The hook's computed style rides on the row; `true` renders data-reorder-row="true".
  const rowProps = i => ({ 'data-reorder-row': true, style: reorder.rowStyle(i) })
  return (
    <div className="g-glist g-glass g-rt-list" ref={reorder.listRef}>
      {rows.map((r, i) => (
        <div key={r.id} {...rowProps(i)} className="g-glist-row g-rt-orow">
          <span className="g-glist-body"><b>{r.name}</b>{r.sub && <span>{r.sub}</span>}</span>
          <button type="button" className="g-rt-btn" aria-label={t('Move {0} up', r.name)} disabled={i === 0} onClick={() => move(i, i - 1)}>
            <Icon name="chevronUp" className="g-icon" />
          </button>
          <button type="button" className="g-rt-btn" aria-label={t('Move {0} down', r.name)} disabled={i === rows.length - 1} onClick={() => move(i, i + 1)}>
            <Icon name="chevronDown" className="g-icon" />
          </button>
          <button type="button" className="g-rt-btn g-rt-handle" aria-label={t('Move {0}', r.name)} {...reorder.handle(i)}>
            <Icon name="chevronsUpDown" className="g-icon" />
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * Training › Routines (boards T4.0, T4.1, T4.4's landing): the routines in your Plan, those not
 * in it, and Freestyle, each group in `S.routines` order, which Reorder changes. A row opens the
 * routine's editor. With Settings › Swipe actions on, a row swipes toward the start to delete
 * (T4.3, with Undo) and toward the end to duplicate; the editor's ⋯ (T5.8) is the keyboard's and
 * the screen reader's way to both.
 */
export default function RoutinesScreen() {
  const r = useRoutines()
  const [ordering, setOrdering] = useState(false)
  const [flash, setFlash] = useState(null)
  const duplicate = id => {
    const copy = r.duplicate(id)
    if (copy) setFlash({ id: copy.id, n: ++flashSeq })
  }
  const row = it => {
    const el = <RoutineRow key={it.id} row={it} onClick={() => r.open(it.id)} />
    return r.swipe
      ? <SwipeRow key={it.id} className="g-rt-sw" copyLabel={t('Duplicate')} onDelete={() => r.remove(it.id)} onCopy={() => duplicate(it.id)}
        flash={flash?.id === it.id ? flash.n : 0}>{el}</SwipeRow>
      : el
  }
  const canOrder = r.count > 1

  return (
    <StagePage largeTitle={t('Routines')} sub={r.sub} parent="/train"
      actions={[{ icon: 'plus', label: t('New routine'), onClick: r.add }]}>
      {r.empty && (
        <StageEmpty illustration="dumbbell" title={t('No routines yet')}
          body={t('A routine is a saved list of exercises with sets, reps and weight. Make one, or start from a ready-made plan.')}
          action={t('New routine')} onClick={r.add}
          actions={[{ label: t('Pick a ready-made plan'), icon: 'clipboard', onClick: r.plans }]} />
      )}
      {!r.empty && ordering && (
        <section className="g-rt-sec">
          <StageSection title={t('Drag to reorder')} action={t('Done')} onAction={() => setOrdering(false)} />
          <ReorderList rows={r.all} move={r.move} />
        </section>
      )}
      {!r.empty && !ordering && (
        <>
          {r.groups.map((g, i) => (
            <section key={g.key} className="g-rt-sec">
              <StageSection title={g.title} {...(i === 0 && canOrder ? { action: t('Reorder'), onAction: () => setOrdering(true) } : null)} />
              <div className="g-glist g-glass g-rt-list">{g.rows.map(row)}</div>
            </section>
          ))}
          <section className="g-rt-sec">
            <StageSection title={r.freestyle.title} />
            <div className="g-glist g-glass g-rt-list">
              <Act onClick={r.startFreestyle} className="g-glist-row g-rt-row">
                <span className="g-glist-ic" aria-hidden="true"><Icon name="shuffle" className="g-icon" /></span>
                <span className="g-glist-body"><b>{r.freestyle.name}</b><span>{r.freestyle.sub}</span></span>
                <Icon name="chevronRight" className="g-icon g-glist-chev" />
              </Act>
            </div>
          </section>
        </>
      )}
    </StagePage>
  )
}
