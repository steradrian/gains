import { t } from '../../lib/i18n.js'
import { useListReorder } from '../../lib/use-list-reorder.js'
import Icon from '../../components/Icon.jsx'
import SwipeRow from '../../components/SwipeRow.jsx'
import Button from '../../ds/Button.jsx'

// The loop's editor, open under the loop card while Edit is on (owner question 1): the loop as
// GlassList rows, each with a minus that takes it out (with Undo), move up and move down for a
// keyboard or a switch, and a handle to drag (the arrow keys move it too). With swipe actions on
// (Settings), a row also swipes toward the start to take it out. Add puts another routine at the
// end. `items` are use-plan's loop items.
export default function LoopEditor({ items, onReorder, onRemove, onAdd, canAdd, swipe }) {
  const reorder = useListReorder(items.length, onReorder)
  const last = items.length - 1
  return (
    <div className="plan-editor g-glass">
      <div className="plan-editor-list" ref={reorder.listRef}>
        {items.map((it, i) => {
          const rowProps = { 'data-reorder-row': '', 'data-id': it.id, style: reorder.rowStyle(i) }
          const row = (
            <div key={it.id} className="g-glist-row plan-erow" {...(swipe ? {} : rowProps)}>
              <button type="button" className="plan-erow-minus g-glass" aria-label={t('Remove {0}', it.name)} onClick={() => onRemove(it.id)}>
                <Icon name="minus" className="g-icon" />
              </button>
              <span className="g-glist-ic" aria-hidden="true">
                {it.state === 'done' ? <Icon name="check" className="g-icon" /> : <span className="plan-erow-n">{it.n}</span>}
              </span>
              <span className="g-glist-body"><b>{it.name}</b>{it.sub && <span>{it.sub}</span>}</span>
              {items.length > 1 && (
                <span className="plan-erow-moves">
                  <button type="button" className="plan-erow-btn g-glass" aria-label={t('Move {0} up', it.name)} disabled={i === 0} onClick={() => onReorder(i, i - 1)}>
                    <Icon name="chevronUp" className="g-icon" />
                  </button>
                  <button type="button" className="plan-erow-btn g-glass" aria-label={t('Move {0} down', it.name)} disabled={i === last} onClick={() => onReorder(i, i + 1)}>
                    <Icon name="chevronDown" className="g-icon" />
                  </button>
                  <button type="button" className="plan-erow-btn plan-erow-handle g-glass" aria-label={t('Move {0}', it.name)} title={t('Drag to reorder')} {...reorder.handle(i)}>
                    <Icon name="chevronsUpDown" className="g-icon" />
                  </button>
                </span>
              )}
            </div>
          )
          return swipe
            ? <SwipeRow key={it.id} {...rowProps} className="plan-swrow" deleteLabel={t('Remove')} deleteIcon="minus" onDelete={() => onRemove(it.id)}>{row}</SwipeRow>
            : row
        })}
      </div>
      <div className="plan-editor-foot">
        <Button variant="glass" size="sm" icon="plus" aria-label={t('Add routine to the rotation')} disabled={!canAdd} onClick={onAdd}>{t('Add')}</Button>
      </div>
    </div>
  )
}
