import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import MenuList from '../ds/MenuList.jsx'
import { DAYN, todayISO, weekOrder, weekStartOf } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MOBILE, printHtml, shareExport } from '../lib/mobile.js'
import { closeThenNav, whenSheetGone } from '../lib/nav.js'
import { planPrintHTML, printPlan } from '../lib/plan-share.js'
import { queueOf } from '../lib/queue.js'
import { rotationIds, scheduleModeOf } from '../lib/rotation.js'
import { buildRoutineBundle } from '../lib/routine-share.js'
import { copyNameOf, deleteRoutineWithUndo, duplicateRoutine, routineDaysOf, saveRoutineDays, weekdayShort } from '../views/routines/routine-actions.js'
import RoutineSettings from '../views/routines/routine-settings.jsx'
import { drawerFlow } from '../store/useUI.js'
import { S, toast, ui } from './shared.js'
import { startFlow } from './workout-flow.jsx'

const routineOf = (st, id) => st.routines.find(r => r.id === id)
const inLoop = (st, id) => scheduleModeOf(st) === 'rotation' && [...(queueOf(st)?.ids ?? []), ...rotationIds(st)].includes(id)

/** Routine `id` as a plan file: a download on the web, the share sheet in the app (as exportPlanFile). */
export async function exportRoutineFile(id) {
  const bundle = buildRoutineBundle(S(), id)
  if (!bundle) return
  const json = JSON.stringify(bundle, null, 2)
  const name = 'gains-routine-' + todayISO() + '.json'
  if (MOBILE) { try { await shareExport(json, name) } catch { /* dismissed */ } return }
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  toast(t('Plan file saved. Send it to a friend!'))
}

/** Routine `id` on paper (#282): the weekly printout's page for one session, through the browser's
 *  print dialog (→ Save as PDF) on the web, the native Print plugin in the app. */
export function printRoutine(id) {
  const st = S(), r = routineOf(st, id)
  if (!r) return
  const owner = useStore.getState().user?.name || ''
  // Android's print manager refuses a job without a name; a routine from an import may have none.
  if (MOBILE) printHtml(planPrintHTML(st, owner, { routineId: id }), r.name || t('Routine')).catch(() => { /* dismissed */ })
  else printPlan(st, owner, { routineId: id })
}

/* ---------------------------------------------------------------- T5.8 the menu -- */

function RoutineMenu({ id, close }) {
  const st = useStore(s => s.S)
  const r = routineOf(st, id)
  if (!r) return null
  const days = routineDaysOf(st, id)
  const empty = !r.ex?.length
  const toEditor = () => closeThenNav(close, '/train/routines/' + id)
  // A routine with nothing in it has nothing to start: it opens in its editor instead.
  const start = () => {
    if (st.active) { closeThenNav(close, '/train/workout'); return }
    if (empty) { toEditor(); return }
    close()
    startFlow([id])
  }
  const items = [
    { key: 'start', icon: 'play', label: t('Start {0}', r.name), onClick: start },
    { key: 'days', icon: 'calendar', label: t('Plan days'),
      detail: days.length ? days.map(weekdayShort).join(', ') : inLoop(st, id) ? t('In your loop') : t('Not in your Plan'),
      onClick: () => drawerFlow(() => planDaysSheet(id)) },
    { key: 'copy', icon: 'copy', label: t('Duplicate'), detail: t('Makes “{0}”', copyNameOf(r)),
      onClick: () => duplicateRoutine(id, { open: true, go: to => closeThenNav(close, to) }) },
    { key: 'share', icon: 'share', label: t('Share routine'), detail: t('As a plan file, or on paper'), onClick: () => drawerFlow(() => shareRoutineSheet(id)) },
    { key: 'settings', icon: 'gear', label: t('Routine settings'), detail: t('Icon, progression and deload'), onClick: () => drawerFlow(() => routineSettingsSheet(id)) },
    // The menu's entry is walked off first and the routine goes after: deleted under the open
    // menu, the editor's missing-routine redirect wrote the address in the same commit as the
    // close, and the menu's history entry stayed behind (Back landed on the deleted routine, again
    // and again). The editor then steps back off its page (use-routine-editor, use-tab-nav back).
    { key: 'delete', icon: 'trash', tone: 'danger', label: t('Delete routine'), detail: t('Comes back with Undo for 8 s'),
      onClick: () => { close(); whenSheetGone(() => deleteRoutineWithUndo(id)) } },
  ]
  return (
    <BottomSheet title={r.name}>
      <MenuList items={items} label={t('Routine options')} />
    </BottomSheet>
  )
}

/**
 * Opens T5.8, routine `id`'s menu (the editor's ⋯). Delete takes the editor off the history, back
 * to the page it was opened from (the Routines page, where its toast shows).
 */
export const routineMenuSheet = id =>
  ui().openSheet(close => <RoutineMenu id={id} close={close} />, { variant: 'ds' })

/* ----------------------------------------------------------- T5.8's drawers -- */

// Plan days: the seven weekdays in the order the week runs, ticked where the routine is. Save
// puts it on exactly those (setRoutineDays), with Undo; a day that holds another routine keeps
// it, and the two train together.
function PlanDaysDrawer({ id, close }) {
  const st = useStore(s => s.S)
  const [picked, setPicked] = useState(() => new Set(routineDaysOf(st, id)))
  const r = routineOf(st, id)
  if (!r) return null
  const order = weekOrder(weekStartOf(st))
  const others = d => [].concat(st.week?.[d] ?? []).filter(x => x !== id).map(x => routineOf(st, x)?.name).filter(Boolean)
  const toggle = d => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(d)) next.delete(d); else next.add(d)
    return next
  })
  const save = () => { close(); saveRoutineDays(id, order.filter(d => picked.has(d))) }
  return (
    <BottomSheet title={t('Plan days')} footer={<Button block onClick={save}>{t('Save')}</Button>}>
      <p className="g-rt-lead">{t('The weekdays {0} is on. A day with another routine trains both.', r.name)}</p>
      <div className="g-glist g-glist-light" role="group" aria-label={t('Plan days')}>
        {order.map(d => {
          const on = picked.has(d)
          const also = others(d)
          return (
            <button key={d} type="button" role="checkbox" aria-checked={on} className="g-radio g-rt-check" onClick={() => toggle(d)}>
              <span className="g-radio-body"><b>{t(DAYN[d])}</b>{also.length > 0 && <span>{t('Also {0}', also.join(', '))}</span>}</span>
              <span className={on ? 'g-radio-mark on' : 'g-radio-mark'} aria-hidden="true">{on && <Icon name="check" className="g-icon" />}</span>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}
export const planDaysSheet = id => ui().openSheet(close => <PlanDaysDrawer id={id} close={close} />, { variant: 'ds' })

// Share routine (owner question 8): the plan file, or the printout.
function ShareRoutineDrawer({ id, close }) {
  const st = useStore(s => s.S)
  const r = routineOf(st, id)
  if (!r) return null
  const empty = !r.ex?.length
  const items = [
    { key: 'file', icon: 'share', label: t('As a plan file'), disabled: empty,
      detail: t('A small file a friend can import into their own Gains. Routines only, none of your workouts or weigh-ins.'),
      onClick: async () => { await exportRoutineFile(id); close() } },
    { key: 'print', icon: 'note', label: t('Print / Save as PDF'), disabled: empty, onClick: () => { close(); printRoutine(id) } },
  ]
  return (
    <BottomSheet title={t('Share routine')}>
      {empty && <p className="g-rt-lead">{t('Add an exercise first. An empty routine has nothing to share.')}</p>}
      <MenuList items={items} label={t('Share routine')} />
    </BottomSheet>
  )
}
export const shareRoutineSheet = id => ui().openSheet(close => <ShareRoutineDrawer id={id} close={close} />, { variant: 'ds' })

function RoutineSettingsDrawer({ id }) {
  return (
    <BottomSheet title={t('Routine settings')}>
      <RoutineSettings id={id} />
    </BottomSheet>
  )
}
export const routineSettingsSheet = id => ui().openSheet(() => <RoutineSettingsDrawer id={id} />, { variant: 'ds' })
