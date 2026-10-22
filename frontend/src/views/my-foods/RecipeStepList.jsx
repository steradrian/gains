import { useEffect, useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { cx } from '../../lib/ui-kit.js'
import Icon from '../../components/Icon.jsx'
import { useRoutineReorder } from '../routines/routine-reorder.js'

// The method of a recipe (board Ea5Recipe): numbered steps, each a text box you write in. Hold a
// step (or take the grip with a mouse) and drag to move it; the arrow buttons are the keyboard's
// way, kept off the screen until they have the focus. The drag is the routine editor's
// (routines/routine-reorder.js), which finds each step by `data-routine-row` and its place by
// `data-ex-index`. `identity` is the recipe, so a drag never carries over to another one.
export default function RecipeStepList({ identity, steps, focusId, onEdit, onRemove, onMove, onShift }) {
  const reorder = useRoutineReorder(identity, steps, onMove)
  const { drag } = reorder
  const [said, setSaid] = useState('')
  const refocus = useRef(null)

  // After a step moved by its button, the focus follows it to the new place.
  useEffect(() => {
    if (!refocus.current) return
    const { to, dir } = refocus.current
    refocus.current = null
    const rows = reorder.listRef.current?.querySelectorAll(`[data-ex-index="${to}"] .g-rec-move`) || []
    const [up, down] = rows
    const same = dir < 0 ? up : down
    const other = dir < 0 ? down : up
    ;(same && !same.disabled ? same : other)?.focus()
  })

  const dragging = i => !!drag && i === drag.first
  const shift = (i, dir) => {
    const to = onShift(i, dir)
    if (to == null) return
    refocus.current = { to, dir }
    setSaid(t('Step {0} moved to {1} of {2}', i + 1, to + 1, steps.length))
  }

  return (
    <div ref={reorder.listRef} onClickCapture={reorder.onClickCapture} className={cx('g-re-list', 'g-rec-steps', drag && 'is-reordering')}>
      <p className="g-sr" aria-live="polite">{said}</p>
      {steps.map((step, i) => (
        <div key={step.id} data-routine-row data-ex-index={i} className={cx('g-re-slot', 'g-rec-step', dragging(i) && 'is-dragging')}
          style={dragging(i) ? { transform: `translate3d(0, ${drag.deltaY}px, 0)` } : undefined}>
          <span className="g-rec-num" aria-hidden="true">{i + 1}</span>
          <textarea className="g-rec-text" rows={2} maxLength={500} value={step.text} autoFocus={step.id === focusId}
            aria-label={t('Step {0}', i + 1)} onChange={e => onEdit(step.id, e.target.value)} />
          <span className="g-rec-tools">
            <button type="button" className="g-rx-btn g-rec-move" aria-label={t('Move step {0} up', i + 1)} disabled={i === 0} onClick={() => shift(i, -1)}>
              <Icon name="chevronUp" className="g-icon" />
            </button>
            <button type="button" className="g-rx-btn g-rec-move" aria-label={t('Move step {0} down', i + 1)} disabled={i === steps.length - 1} onClick={() => shift(i, 1)}>
              <Icon name="chevronDown" className="g-icon" />
            </button>
            <span className="g-rx-handle" data-drag-handle aria-hidden="true"><Icon name="grip" className="g-icon" /></span>
            <button type="button" className="g-rx-btn" aria-label={t('Remove step {0}', i + 1)} onClick={() => onRemove(step.id)}>
              <Icon name="xmark" className="g-icon" />
            </button>
          </span>
        </div>
      ))}
      {drag && <div className="g-re-drop" aria-hidden="true" style={{ top: `${drag.indicatorTop}px` }} />}
    </div>
  )
}
