import { useEffect, useRef, useState } from 'react'
import { useExerciseStill } from '../../components/CustomMedia.jsx'
import SwipeRow from '../../components/SwipeRow.jsx'
import BodyMap from '../../ds/BodyMap.jsx'
import Button from '../../ds/Button.jsx'
import InlineBanner from '../../ds/InlineBanner.jsx'
import RoutineExerciseRow from '../../ds/RoutineExerciseRow.jsx'
import SavedIndicator from '../../ds/SavedIndicator.jsx'
import StageEmpty from '../../ds/StageEmpty.jsx'
import StagePage from '../../ds/StagePage.jsx'
import StageSection from '../../ds/StageSection.jsx'
import SupersetGroup from '../../ds/SupersetGroup.jsx'
import TextField from '../../ds/TextField.jsx'
import { figureOf } from '../../lib/exercises.js'
import { t } from '../../lib/i18n.js'
import { cx } from '../../lib/ui-kit.js'
import { useStore } from '../../store/useStore.js'
import { useRoutineEditor } from './use-routine-editor.js'

// One exercise of the list, with its picture (a custom exercise's own, from the local store).
function ExerciseRow({ row, figure, ordering, editor, onMove }) {
  const image = useExerciseStill(row.ex, figure)
  const i = row.index
  return (
    <RoutineExerciseRow image={image} title={row.title} sub={row.sub} line={row.line} note={row.note}
      badge={row.badge} warning={row.warning} onOpen={() => editor.configure(i)}
      {...(ordering ? {
        moveUp: { label: t('Move {0} up', row.title), title: row.leavesUp ? t('Move out of the superset') : undefined, disabled: !row.up, onClick: () => onMove(row, -1) },
        moveDown: { label: t('Move {0} down', row.title), title: row.leavesDown ? t('Move out of the superset') : undefined, disabled: !row.down, onClick: () => onMove(row, 1) },
        handle: { title: t('Reorder exercises') },
      } : null)} />
  )
}

/**
 * A routine (boards T5.0, Tr5RoutinePull, Tr5RoutineLegs, T5.4, T5.6), at /train/routines/:id: the
 * name, where it is in the Plan, whether the last change has saved, the muscles it works on the
 * app's map, and its exercises with their supersets. A tap on an exercise opens its settings (T5.5:
 * Remove with Undo, Replace, Superset with the exercise above); Reorder shows the move buttons and
 * the grips, and a long press (or a mouse on a grip) drags a row, a superset whole. Add exercise
 * opens the picker, several at a time. ⋯ is the routine's menu (T5.8). Everything saves as it
 * changes. `?new=1` (T5.6) is a routine just made: its name is focused and selected.
 */
export default function RoutineEditor() {
  const editor = useRoutineEditor()
  const figure = useStore(s => figureOf(s.S))
  const body = useStore(s => s.S.body)
  const [orderingOn, setOrdering] = useState(false)
  const nameRef = useRef(null)
  const rootRef = useRef(null)
  // A move button keeps the keyboard on the exercise it moved, not on the row that slid into its
  // place: the same arrow on its new row, or the other one where the move reached an edge. The
  // move is said in the polite live region below.
  const [moveSaid, setMoveSaid] = useState('')
  const focusAfterMove = useRef(null)
  useEffect(() => {
    if (!editor.fresh) return
    nameRef.current?.focus()
    nameRef.current?.select()
  }, [])
  useEffect(() => {
    const want = focusAfterMove.current
    if (!want) return
    focusAfterMove.current = null
    const [up, down] = rootRef.current?.querySelectorAll(`[data-ex-index="${want.to}"] .g-rx-btn`) || []
    const same = want.dir < 0 ? up : down
    const other = want.dir < 0 ? down : up
    ;(same && !same.disabled ? same : other)?.focus()
  })
  const r = editor.routine
  if (!r) return null
  const empty = !r.ex.length
  // Reorder mode needs two exercises; it ends by itself when a removal leaves one.
  const ordering = orderingOn && r.ex.length > 1
  const drag = editor.reorder.drag
  const dragging = i => !!drag && i >= drag.first && i <= drag.last
  const moved = drag ? { transform: `translate3d(0, ${drag.deltaY}px, 0)` } : undefined
  const onMove = (row, dir) => {
    const to = editor.move(row.index, dir)
    if (to == null) return
    focusAfterMove.current = { to, dir }
    setMoveSaid(t('{0} moved to {1} of {2}', row.title, to + 1, r.ex.length))
  }

  // The slot a drag measures and moves (routine-reorder.js): a single exercise moves by itself, a
  // superset's rows move with their group. Swipe (Settings › Swipe actions) takes one out toward
  // the start of the line, with an Undo; a row a long press has lifted keeps the swipe out.
  const slot = (i, alone) => {
    const row = editor.rows[i]
    const inner = <ExerciseRow row={row} figure={figure} ordering={ordering} editor={editor} onMove={onMove} />
    return (
      <div key={i} data-routine-row data-ex-index={i} className={cx('g-re-slot', dragging(i) && 'is-dragging')}
        style={alone && dragging(i) ? moved : undefined}>
        {editor.swipe
          ? <SwipeRow className="g-re-sw" deleteLabel={t('Remove')} deleteIcon="minus" closeKey={r.ex.length}
            canSwipe={() => !editor.reorder.lifted()} onDelete={() => editor.remove(i)}>{inner}</SwipeRow>
          : inner}
      </div>
    )
  }

  return (
    <StagePage title={r.name} parent="/train/routines"
      actions={[{ icon: 'more', label: t('Routine options'), onClick: editor.menu }]}>
      <div className="g-re" ref={rootRef}>
        <p className="g-sr" aria-live="polite">{moveSaid}</p>
        <div className="g-re-head">
          <TextField tone="stage" wide label={t('Routine name')} value={r.name} onChange={editor.rename} inputRef={nameRef} />
          <p className="g-re-plan">{editor.plan}</p>
          <div className="g-re-saved">
            <SavedIndicator tone="stage" state={editor.saved} />
            <span>{t('Autosaves as you edit')}</span>
          </div>
          {!empty && (
            <>
              {editor.muscles && <p className="g-re-muscles">{editor.muscles}</p>}
              <div className="g-re-map"><BodyMap levels={editor.levels} body={body} width={120} label={t('What this session hits')} /></div>
              <p className="g-re-stats">{editor.stats}</p>
            </>
          )}
        </div>

        {editor.missing && <InlineBanner stage icon="warning" tone="warning" title={editor.missing} />}

        {empty
          ? <StageEmpty illustration="dumbbell" title={t('Nothing in it yet')} body={t('Add exercises from the library. Sets, reps and weight come next.')}
            action={t('Add exercises')} onClick={editor.pick} />
          : (
            <section className="g-re-sec">
              <StageSection title={ordering ? t('Drag to reorder') : t('Exercises')}
                {...(r.ex.length > 1 ? { action: ordering ? t('Done') : t('Reorder'), onAction: () => setOrdering(!ordering) } : null)} />
              <div ref={editor.reorder.listRef} onClickCapture={editor.reorder.onClickCapture}
                className={cx('g-re-list', drag && 'is-reordering', ordering && 'is-ordering')}>
                {editor.units.map(unit => (unit.superset
                  ? (
                    <SupersetGroup key={unit.key} title={unit.title} detail={unit.detail}
                      onClick={() => editor.editSuperset(unit.indices[0])}
                      label={[unit.title, unit.detail, t('Name and rest of this superset')].filter(Boolean).join(', ')}
                      className={cx(dragging(unit.indices[0]) && 'is-dragging')} style={dragging(unit.indices[0]) ? moved : undefined}>
                      {unit.indices.map(i => slot(i, false))}
                    </SupersetGroup>
                  )
                  : slot(unit.indices[0], true)))}
                {drag && <div className="g-re-drop" data-testid="routine-drop-indicator" aria-hidden="true" style={{ top: `${drag.indicatorTop}px` }} />}
              </div>
              <Button variant="glass" icon="plus" className="g-re-add" onClick={editor.pick}>{t('Add exercise')}</Button>
            </section>
          )}

        <Button block className="g-re-start" icon="play" disabled={empty} onClick={editor.start}>{t('Start {0}', r.name)}</Button>
      </div>
    </StagePage>
  )
}
