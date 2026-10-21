import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { DAYS, weekOrder, weekStartOf, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import {
  starterPlanSheet, menuSheet,
  planHasRoutines, exportPlanFile, printWholePlan, importPlanFile,
} from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import SwipeRow from '../components/SwipeRow.jsx'
import { copyRoutine, deleteRoutine, restoreRoutine, routineSnapshot } from '../lib/routines.js'
import { workoutControls } from '../lib/workout-controls.js'
import { useListReorder } from '../lib/use-list-reorder.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { nav as navigateTo } from '../lib/nav.js'
import { Inline, Page } from '../components/layout.jsx'
import { EmptyState, ItemRow } from '../components/blocks.jsx'
import { markUndone, undoMarks } from '../lib/sync-merge.js'

// A new, empty routine, opened in the editor: the Routines page's "New routine" and the + sheet's.
// `go` opens the editor; from a sheet it is `to => closeThenNav(close, to)`, so the sheet's history
// entry is not left behind under the editor.
export function addRoutine(go = navigateTo) {
  const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
  useStore.getState().update(s => { s.routines.push(r) })
  go('/train/routines/' + r.id)
}

/* Undo for Plan's two removals (v1.3.11). Both go through the store's normal update, so sync
   sees an ordinary edit (a routine put back clears its own removal stamp, lib/sync-merge.js). */

/** Deletes a routine with an Undo toast in place of a confirm: the toast puts it back exactly,
 *  list place, weekdays, reschedules and loop included (lib/routines.js routineSnapshot). */
export function deleteRoutineWithUndo(id) {
  const st = useStore.getState()
  const snap = routineSnapshot(st.S, id)
  if (!snap) return false
  const before = st.S
  st.update(s => { deleteRoutine(s, id) })
  // What the removal moved (weekdays, reschedules, the loop), for the Undo to mark as put back:
  // a change another device made to one of them before it saw the removal then still wins.
  snap.marks = undoMarks(before, useStore.getState().S)
  useUI.getState().toast(t('“{0}” gone.', snap.routine.name), { action: t('Undo'), onAction: () => undoDeleteRoutine(snap) })
  return true
}
export function undoDeleteRoutine(snap) {
  let ok = false
  useStore.getState().update(s => { ok = restoreRoutine(s, snap); if (ok && snap.marks) markUndone(s, snap.marks) })
  // False when a sync brought it back first (another device's Undo, or its later edit).
  if (!ok) useUI.getState().toast(t('It’s already back.'))
  return ok
}

// The flash a row lands with when a swipe brought it (a duplicate, an undo): one per new value.
let flashSeq = 0

// Training › Routines (what you train). Training › Plan is views/plan/PlanScreen.jsx.
export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const fileRef = useRef(null)

  // Share, print, import and starter plans: one menu behind the header button, so the
  // page below is only about the routines themselves.
  const openMenu = () => {
    const has = planHasRoutines(S)
    menuSheet({
      title: t('Plan'),
      subtitle: has ? null : t('Add an exercise to a routine first. An empty plan has nothing to share.'),
      items: [
        { icon: 'share', label: t('Export plan file'), sub: t('A small file a friend can import into their own Gains. Routines only, none of your workouts or weigh-ins.'), disabled: !has, onClick: exportPlanFile },
        { icon: 'note', label: t('Print / Save as PDF'), disabled: !has, onClick: printWholePlan },
        { icon: 'download', label: t('Import a plan file'), onClick: () => fileRef.current?.click() },
        { icon: 'clipboard', label: t('Load starter plan'), onClick: starterPlanSheet },
      ],
    })
  }
  const pickFile = ev => { const f = ev.target.files[0]; ev.target.value = ''; importPlanFile(f) }

  return <div className="plan">
    <Page title={t('Routines')}
      action={<button className="iconbtn" onClick={openMenu} aria-label={t('Plan options')} title={t('Plan options')}><Icon name="share" /></button>}>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} hidden />
      <Routines S={S} update={update} nav={nav} />
    </Page>
  </div>
}

/* ================================ Routines ================================ */

function Routines({ S, update, nav }) {
  const [edit, setEdit] = useState(false)
  const [flash, setFlash] = useState(null)
  const swipe = workoutControls(S).swipeSets
  const routines = S.routines
  // The order of this list is the order of `S.routines`, and every other screen reads the same
  // array (the Start screen, the day sheets, the routine pickers), so moving a routine here moves
  // it everywhere (#142). Reordering lives behind Edit, like on an iPhone.
  const reorder = useListReorder(routines.length, (from, to) => update(s => {
    if (to < 0 || to >= s.routines.length) return
    const [m] = s.routines.splice(from, 1)
    s.routines.splice(to, 0, m)
  }))

  // The same delete as RoutineEdit's "Delete routine" button (lib/routines.js), with an Undo in
  // place of its confirm (v1.3.11): the swipe and the edit-mode minus both land here.
  const remove = r => deleteRoutineWithUndo(r.id)
  // The swipe's other side: a copy right below the original, named the way "Copy routine" names
  // one, and staying on this list rather than opening it.
  const duplicate = r => {
    const copy = copyRoutine(r, t('Copy'))
    update(s => {
      const at = s.routines.findIndex(x => x.id === r.id)
      s.routines.splice(at < 0 ? s.routines.length : at + 1, 0, copy)
    })
    setFlash({ id: copy.id, n: ++flashSeq })
    // With its own Undo: the toast takes the place of any Undo still showing (one toast at a
    // time), so the newest swipe is at least the one you can take back.
    useUI.getState().toast(t('Copied as “{0}”.', copy.name), { action: t('Undo'), onAction: () => {
      update(s => { if (s.routines.some(x => x.id === copy.id)) deleteRoutine(s, copy.id) })
    } })
  }
  // The weekdays a routine is on, short, in the order the week runs.
  const order = weekOrder(weekStartOf(S))
  const daysOf = id => order.filter(d => [].concat(S.week[d] || []).includes(id)).map(d => t(DAYS[d]))
  const sub = r => [exCount(r.ex.length), daysOf(r.id).join(', ')].filter(Boolean).join(' · ')
  // The edit-mode row's reorder hooks. The row style is the hook's computed one; `true` renders
  // data-reorder-row="true", as the bare attribute did.
  const editRowProps = i => ({ 'data-reorder-row': true, style: reorder.rowStyle(i) })

  return <>
    <Inline justify="between" className="plan-sec-h plan-routines-bar">
      {routines.length > 0
        ? <button className="plan-textbtn" aria-pressed={edit} onClick={() => setEdit(e => !e)}>{edit ? t('Done') : t('Edit')}</button>
        : <span />}
      <Button size="sm" variant="tinted" icon="plus" onClick={() => addRoutine()}>{t('New routine')}</Button>
    </Inline>
    {routines.length ? <>
      {edit
        ? <div className="list routine-list plan-routines is-editing" ref={reorder.listRef}>{routines.map((r, i) =>
          <ItemRow key={r.id} {...editRowProps(i)} className="plan-routine"
            lead={<>
              <button className="plan-minus" aria-label={t('Delete {0}', r.name)} title={t('Delete routine')} onClick={() => remove(r)}><Icon name="minus" /></button>
              <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
            </>}
            title={r.name} subtitle={sub(r)}
            trailing={routines.length > 1 && <button className="plan-handle" aria-label={t('Move {0}', r.name)} title={t('Drag to reorder')}
              {...reorder.handle(i)}><Icon name="chevronsUpDown" /></button>} />)}</div>
        : <div className="list routine-list plan-routines">{routines.map(r => {
          const row = <ItemRow key={r.id} className="plan-routine" onClick={() => nav('/train/routines/' + r.id)}
            lead={<span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>}
            title={r.name} subtitle={sub(r)} chevron />
          // Swipe (v1.3.11, Settings → Swipe actions): toward the start deletes with an Undo,
          // toward the end duplicates. Edit's minus and the routine's own page stay the way in
          // for a keyboard and a screen reader.
          return swipe
            ? <SwipeRow key={r.id} className="swrow-item" copyLabel={t('Duplicate')}
              onDelete={() => remove(r)} onCopy={() => duplicate(r)}
              flash={flash?.id === r.id ? flash.n : 0}>{row}</SwipeRow>
            : row
        })}</div>}
      <p className="sect-f">{edit ? t('Drag to reorder. Tap the minus to delete.') : t('Tap a routine to edit it. Reorder and delete are behind Edit.')}</p>
    </> : <EmptyState illustration="routine" title={t('No routines yet')} body={t('Make one, or grab the starter plan to get going.')}
      action={{ icon: 'clipboard', label: t('Load starter plan'), onClick: starterPlanSheet }} />}
  </>
}
