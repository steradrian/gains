import { useRef } from 'react'
import { useStore } from '../store/useStore.js'
import { todayISO, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { closeThenNav, nav, onSheetEntry } from '../lib/nav.js'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { buildPlanBundle, parsePlan, printPlan, planPrintHTML } from '../lib/plan-share.js'
import { MOBILE, shareExport, printHtml } from '../lib/mobile.js'
import BottomSheet from '../ds/BottomSheet.jsx'
import MenuList from '../ds/MenuList.jsx'
import { drawerFlow } from '../store/useUI.js'
import { S, ui, toast } from './shared.js'

export { dayOverrideSheet, dayNoteSheet, usePlanDayParam } from './plan-day.jsx'

// The page a picked plan file opens on (PR02 T3.7, views/plan-import/PlanImportPage.jsx).
export const PLAN_IMPORT_PATH = '/train/schedule/import'
// What the file picker takes: an export is JSON, whatever its name ends in.
export const PLAN_FILE_ACCEPT = 'application/json,.json,.gains'

// What the Plan menu and the share drawer both do with a plan, so the two can never drift.
export const planHasRoutines = st => (st.routines || []).some(r => r.ex && r.ex.length)
export async function exportPlanFile() {
  const st = S(), user = useStore.getState().user
  const bundle = buildPlanBundle(st, user?.name ? t('{0}’s plan', user.name) : '')
  const json = JSON.stringify(bundle, null, 2)
  const name = 'gains-plan-' + todayISO() + '.json'
  if (MOBILE) { try { await shareExport(json, name) } catch (e) { /* dismissed */ } return }
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
  toast(t('Plan file saved. Send it to a friend!'))
}
// Web: the browser's print dialog (→ Save as PDF). Mobile: the OS print flow via the native
// Print plugin — Android WebView has no window.print(). Same printable HTML both ways.
export function printWholePlan() {
  const st = S(), owner = useStore.getState().user?.name || ''
  if (MOBILE) printHtml(planPrintHTML(st, owner), t('Weekly Training Plan')).catch(() => { /* dismissed */ })
  else printPlan(st, owner)
}

/**
 * A picked plan file → the import page (T3.7), with the parsed plan as `state.bundle`, or in its
 * error state (`state.error`: parsePlan's own refusal, written for people, or '' for anything
 * else, which is not shown raw). `onRead` runs first, to close the drawer the file came from; the
 * page then takes that drawer's history entry, and a second file picked on the page takes its own.
 */
export function importPlanFile(f, onRead) {
  if (!f) return
  const land = state => {
    const here = String(globalThis.location?.hash || '').startsWith('#' + PLAN_IMPORT_PATH)
    const replace = here || onSheetEntry()
    onRead?.()
    nav(PLAN_IMPORT_PATH, replace ? { state, replace: true } : { state })
  }
  const rd = new FileReader()
  rd.onload = () => {
    let bundle
    try { bundle = parsePlan(rd.result, S().unit || 'kg') } catch (e) { land({ error: e?.code === 'not-plan' ? e.message : '' }); return }
    land({ bundle })
  }
  rd.onerror = () => land({ error: '' })
  rd.readAsText(f)
}

/* T3.5 Plan menu (board Tr3Menu): share, import a file, a ready-made plan, and the coach when
   there is one. */
function PlanMenuDrawer({ close }) {
  const st = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const fileRef = useRef(null)
  const has = planHasRoutines(st)
  const coach = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  const pickFile = ev => { const f = ev.target.files[0]; ev.target.value = ''; importPlanFile(f, close) }
  const items = [
    { key: 'share', icon: 'share', label: t('Share your plan'), disabled: !has, onClick: () => drawerFlow(planShareSheet),
      detail: has ? t('Send your routines to a friend, or put your week on paper.') : t('Add an exercise to a routine first. An empty plan has nothing to share.') },
    { key: 'import', icon: 'download', label: t('Import a plan file'), detail: t('Got a plan from a friend?'), onClick: () => fileRef.current?.click() },
    { key: 'plans', icon: 'clipboard', label: t('Ready-made plans'), detail: t('Add a starter plan to your week'), onClick: () => closeThenNav(close, '/train/plans') },
    coach && { key: 'coach', icon: 'chat', label: t('Coach'), detail: t('Plan design and reviews, from your own training'), onClick: () => closeThenNav(close, '/train/coach') },
  ].filter(Boolean)
  return (
    <BottomSheet title={t('Plan')}>
      <MenuList items={items} label={t('Plan')} />
      <input ref={fileRef} type="file" accept={PLAN_FILE_ACCEPT} onChange={pickFile} hidden />
    </BottomSheet>
  )
}
/** Opens T3.5, the Plan page's ⋯. */
export const planToolsSheet = () => ui().openSheet(close => <PlanMenuDrawer close={close} />, { variant: 'ds' })

/* T3.6 Share your plan (board Tr3Share): what goes out, then the file or the printout. Both need a
   routine with an exercise in it. */
function PlanShareDrawer({ close }) {
  const st = useStore(s => s.S)
  const has = planHasRoutines(st)
  const shared = (st.routines || []).filter(r => r.ex?.length)
  const total = shared.reduce((n, r) => n + r.ex.length, 0)
  const items = [
    { key: 'export', icon: 'share', label: t('Export plan file'), detail: t('A .json file a friend can import'), disabled: !has,
      onClick: async () => { await exportPlanFile(); close() } },
    { key: 'print', icon: 'note', label: t('Print / Save as PDF'), detail: t('A clean printout, one page per plan. No exercise ever gets split across pages.'), disabled: !has,
      onClick: () => { close(); printWholePlan() } },
  ]
  return (
    <BottomSheet title={t('Share your plan')}>
      <div className="g-tr3-card">
        <b>{t('Weekly Training Plan')}</b>
        <span>{has ? [...shared.map(r => r.name), exCount(total)].join(' · ') : t('Add an exercise to a routine first. An empty plan has nothing to share.')}</span>
      </div>
      <MenuList items={items} label={t('Share your plan')} />
    </BottomSheet>
  )
}
/** Opens T3.6. */
export const planShareSheet = () => ui().openSheet(close => <PlanShareDrawer close={close} />, { variant: 'ds' })
