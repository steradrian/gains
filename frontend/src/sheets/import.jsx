import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { fmtDate, fmtDateRange } from '../lib/format.js'
import { effortOf } from '../lib/history.js'
import { t, tn } from '../lib/i18n.js'
import { SectionTitle, Tiles } from '../components/blocks.jsx'
import { Inline } from '../components/layout.jsx'
import { Switch } from '../components/ui.jsx'
import BottomSheet from '../ds/BottomSheet.jsx'
import Button from '../ds/Button.jsx'
import { parseImport, parseImportSheets, mergeImport } from '../lib/import-csv.js'
import { readXlsx, XLSX_TYPE } from '../lib/xlsx.js'
import { mergeHevyRoutines } from '../lib/import-hevy.js'
import { importOutcome, hevyOutcome } from '../lib/import-outcome.js'
import { S, update, ui, toast } from './shared.js'

/* ============================ import from another app ============================ */
// "12 sets bring an RPE with them": the file rated its sets. The column is off by default, so
// with it off the line says where to switch it on.
const effortLine = (effort, n, scale) => effort === 'none'
  ? tn('{0} set brings an {1} with it. Switch on Effort per set in Settings to see it.', '{0} sets bring an {1} with them. Switch on Effort per set in Settings to see it.', n, scale)
  : tn('{0} set brings an {1} with it.', '{0} sets bring an {1} with them.', n, scale)
// Shows what a parsed export would actually do before anything is written. An import is
// the one action where "just try it" is expensive — it's someone's entire training
// history — so the numbers, the unit conversion and the exercises we couldn't recognise
// are all on screen before the confirm button.
// `onImported(outcome)` takes over from the toast: Settings' Import page shows its done screen
// (lib/import-outcome.js says what was imported and what was left alone).
function ImportSummary({ parsed, close, onImported }) {
  const st = useStore(s => s.S)
  const isBW = parsed.kind === 'bodyweight'
  const have = isBW
    ? parsed.bodyweight.filter(b => st.bodyweight.some(x => x.d === b.d)).length
    : parsed.workouts.filter(w => st.workouts.some(x => x.d === w.d)).length
  const fresh = (isBW ? parsed.bodyweight.length : parsed.workouts.length) - have
  // Weigh-ins the same workbook carried (MacroFactor's), merged alongside the workouts.
  const weighIns = isBW ? null : parsed.bodyweight
  const freshBW = weighIns ? weighIns.bodyweight.filter(b => !st.bodyweight.some(x => x.d === b.d)).length : 0

  const doImport = () => {
    let res, haveDays, newNames, addedBW = 0
    update(s => {
      haveDays = new Set((isBW ? s.bodyweight : s.workouts).map(x => x.d))
      const known = new Set((s.customEx || []).map(c => c.id))
      res = mergeImport(s, parsed)
      if (weighIns) addedBW = mergeImport(s, weighIns).added
      newNames = (s.customEx || []).filter(c => !known.has(c.id)).map(c => c.n)
    })
    close()
    if (onImported) { onImported(importOutcome({ parsed, haveDays, res, newNames, weighIns: addedBW })); return }
    toast(isBW
      ? tn('{0} weigh-in imported', '{0} weigh-ins imported', res.added)
      : [
        (res.added > 0 || !addedBW) && tn('{0} workout imported', '{0} workouts imported', res.added),
        addedBW > 0 && tn('{0} weigh-in imported', '{0} weigh-ins imported', addedBW),
      ].filter(Boolean).join(' · '))
  }

  // Cancel and Import sit in the sheet's fixed foot, side by side, so a long list of new
  // exercises scrolls under them instead of pushing them off the screen.
  return <BottomSheet title={parsed.source ? t('Import from {0}', parsed.source) : t('Import history')}
    footer={<div className="g-en-foot">
      <Button variant="secondary" onClick={close}>{t('Cancel')}</Button>
      <Button variant="primary" onClick={doImport} disabled={!fresh && !freshBW}>
        {fresh || freshBW ? t('Import') : t('Nothing new to import')}
      </Button>
    </div>}>
    <div className="muted small mb-6">
      {fmtDateRange(parsed.from, parsed.to, true)}
    </div>

    <Tiles className="ta-start">
      {isBW ? <>
        <div className="tile"><div className="l">{t('Weigh-ins')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.bodyweight.length}</div></div>
        <div className="tile"><div className="l">{t('New')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{fresh}</div></div>
      </> : <>
        <div className="tile"><div className="l">{t('Workouts')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.workouts.length}</div></div>
        <div className="tile"><div className="l">{t('Sets')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.sets}</div></div>
        <div className="tile"><div className="l">{t('Exercises matched')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.matched}</div></div>
        <div className="tile"><div className="l">{t('Added as your own')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{parsed.created}</div></div>
      </>}
    </Tiles>

    {parsed.mixedUnits ? <div className="small ink-warn mb-5">
      {t('The file mixes kg and lb, so each set is converted to {0}.', st.unit)}
    </div> : parsed.converted ? <div className="small ink-warn mb-5">
      {t('The file is in {0} and your profile is in {1}, so weights get converted.', parsed.fileUnit, st.unit)}
    </div> : null}
    {!isBW && !parsed.fileUnit && !parsed.mixedUnits && <div className="small dim mb-5">
      {t('The file doesn’t say which unit it uses, so numbers are imported as they are.')}
    </div>}
    {have > 0 && <div className="small dim mb-5">
      {t('{0} days already have data here and will be left alone.', have)}
    </div>}
    {/* The file rated its sets. Say so: the column is off by default, so the ratings would
        otherwise arrive invisibly and look like they had been dropped. */}
    {!isBW && (parsed.rirSets + parsed.rpeSets) > 0 && <div className="small dim mb-5">
      {effortLine(effortOf(st), parsed.rirSets || parsed.rpeSets, parsed.rirSets ? 'RIR' : 'RPE')}
    </div>}
    {/* Rows the parser could not use (no date or name, nothing measured, impossible numbers)
        are left out; say how many, so a short history does not look like a lost one. */}
    {!isBW && parsed.skipped > 0 && <div className="small dim mb-5">
      {tn('{0} row skipped (couldn’t read it)', '{0} rows skipped (couldn’t read them)', parsed.skipped)}
    </div>}
    {!isBW && parsed.unmatchedNames.length > 0 && <>
      <SectionTitle>{t('Not in the library, so they’re added as your own exercises')}</SectionTitle>
      <div className="mchips mb-6">
        {parsed.unmatchedNames.slice(0, 12).map(n => <span key={n} className="mchip capitalize">{n}</span>)}
        {parsed.unmatchedNames.length > 12 && <span className="mchip">+{parsed.unmatchedNames.length - 12}</span>}
      </div>
    </>}

    {freshBW > 0 && <div className="small dim mb-5">
      {tn('Also brings {0} new weigh-in.', 'Also brings {0} new weigh-ins.', freshBW)}
    </div>}
  </BottomSheet>
}

const isSpreadsheet = file => /\.xlsx$/i.test(file.name || '') || file.type === XLSX_TYPE

/** Read a CSV/XML/XLSX export, then show what it would do. `onImported(outcome)` hears what the import did. */
export async function importFromApp(file, { onImported } = {}) {
  const opts = { unit: S().unit, customEx: S().customEx }
  let parsed
  try {
    parsed = isSpreadsheet(file)
      ? parseImportSheets(await readXlsx(await file.arrayBuffer()), opts)
      : parseImport(await file.text(), opts)
  } catch (e) { toast(t('Could not read that file')); return }
  if (parsed.error === 'empty') { toast(t('That file is empty')); return }
  if (parsed.error) { toast(t("We don't recognise that file's columns. Check the docs for supported apps.")); return }
  if (parsed.kind === 'bodyweight' ? !parsed.bodyweight.length : !parsed.workouts.length) {
    toast(t('Nothing to import from that file')); return
  }
  // A design-system sheet (ds/BottomSheet) opens in the ds frame; in the old one it sat collapsed.
  ui().openSheet(close => <ImportSummary parsed={parsed} close={close} onImported={onImported} />, { variant: 'ds' })
}

/* ============================ import from Hevy API ============================ */
// The key is read once by Settings' Import page (pages/hevy-key-sheet.jsx), held in a variable
// for the length of the fetch and never written to the store / localStorage / the server
// (lib/import-hevy.js importHevyData). After a successful fetch this sheet lets the person pick
// workouts, routines and/or weigh-ins before anything is merged.

/** The sheet after the fetch: what Hevy sent, a switch for each part, then the merge. */
export function showHevyPreview(payload, { onImported } = {}) {
  ui().openSheet(close => <HevyPreview payload={payload} close={close} onImported={onImported} />, { variant: 'ds' })
}

function HevyPreview({ payload, close, onImported }) {
  const st = useStore(s => s.S)
  const [wantWorkouts, setWantWorkouts] = useState(!!payload.workouts.workouts.length)
  const [wantRoutines, setWantRoutines] = useState(!!payload.routines.routines.length)
  const [wantBody, setWantBody] = useState(!!payload.bodyweight.bodyweight.length)

  const doImport = () => {
    const parts = []
    let addedW = 0, addedR = 0, addedB = 0, haveDays, newNames
    update(s => {
      haveDays = new Set(s.workouts.map(x => x.d))
      const known = new Set((s.customEx || []).map(c => c.id))
      if (wantWorkouts && payload.workouts.workouts.length) {
        const res = mergeImport(s, payload.workouts)
        addedW = res.added
        parts.push(tn('{0} workout imported', '{0} workouts imported', res.added))
      }
      if (wantRoutines && payload.routines.routines.length) {
        const res = mergeHevyRoutines(s, payload.routines)
        addedR = res.added
        parts.push(tn('{0} routine imported', '{0} routines imported', res.added))
      }
      if (wantBody && payload.bodyweight.bodyweight.length) {
        const res = mergeImport(s, payload.bodyweight)
        addedB = res.added
        parts.push(tn('{0} weigh-in imported', '{0} weigh-ins imported', res.added))
      }
      newNames = (s.customEx || []).filter(c => !known.has(c.id)).map(c => c.n)
    })
    close()
    if (!addedW && !addedR && !addedB) { toast(t('Nothing new to import')); return }
    if (onImported) { onImported(hevyOutcome({ payload, haveDays, added: { workouts: addedW, routines: addedR, weighIns: addedB }, newNames })); return }
    toast(parts.join(' · '))
  }

  const w = payload.workouts
  const r = payload.routines
  const b = payload.bodyweight
  const haveW = w.workouts.filter(x => st.workouts.some(y => y.d === x.d)).length
  const freshW = w.workouts.length - haveW
  const haveB = b.bodyweight.filter(x => st.bodyweight.some(y => y.d === x.d)).length
  const freshB = b.bodyweight.length - haveB
  // Routines are always added as new copies (same as plan import).
  const freshR = r.routines.length
  const canImport = (wantWorkouts && freshW > 0) || (wantRoutines && freshR > 0) || (wantBody && freshB > 0)
  const unmatched = [...new Set([
    ...(wantWorkouts ? w.unmatchedNames : []),
    ...(wantRoutines ? r.unmatchedNames : []),
  ])].sort()

  // The same fixed foot as a file's import summary: Cancel and Import side by side.
  return <BottomSheet title={t('Import from Hevy')}
    footer={<div className="g-en-foot">
      <Button variant="secondary" onClick={close}>{t('Cancel')}</Button>
      <Button variant="primary" onClick={doImport} disabled={!canImport}>
        {canImport ? t('Import') : t('Nothing new to import')}
      </Button>
    </div>}>
    <div className="muted small mb-6">
      {w.from && (w.from === w.to ? fmtDate(w.from, true) : fmtDate(w.from, true) + ' – ' + fmtDate(w.to, true))}
      {!w.from && b.from && (b.from === b.to ? fmtDate(b.from, true) : fmtDate(b.from, true) + ' – ' + fmtDate(b.to, true))}
    </div>

    <Tiles className="ta-start">
      <div className="tile"><div className="l">{t('Workouts')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{w.workouts.length}</div></div>
      <div className="tile"><div className="l">{t('Routines')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{r.routines.length}</div></div>
      <div className="tile"><div className="l">{t('Exercises matched')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{w.matched + r.matched}</div></div>
      <div className="tile"><div className="l">{t('Added as your own')}</div><div className="v" style={{ fontSize: '1.1rem' }}>{w.created + r.created}</div></div>
    </Tiles>

    {w.workouts.length > 0 && <Inline justify="between" style={{ padding: '10px 2px', borderTop: '1px solid var(--sep)' }}>
      <div>
        <div className="tt fs-subhead">{t('Import workouts')}</div>
        <div className="small dim">{t('{0} new · {1} days already here', freshW, haveW)}</div>
      </div>
      <Switch checked={wantWorkouts} onChange={setWantWorkouts} />
    </Inline>}
    {r.routines.length > 0 && <Inline justify="between" style={{ padding: '10px 2px', borderTop: '1px solid var(--sep)' }}>
      <div>
        <div className="tt fs-subhead">{t('Import routines')}</div>
        <div className="small dim">{t('{0} routines · {1} exercises, added as new plans', freshR, r.exerciseCount)}</div>
      </div>
      <Switch checked={wantRoutines} onChange={setWantRoutines} />
    </Inline>}
    {b.bodyweight.length > 0 && <Inline justify="between" className="mb-4" style={{ padding: '10px 2px', borderTop: '1px solid var(--sep)', borderBottom: '1px solid var(--sep)' }}>
      <div>
        <div className="tt fs-subhead">{t('Import weigh-ins')}</div>
        <div className="small dim">{t('{0} new · {1} days already here', freshB, haveB)}</div>
      </div>
      <Switch checked={wantBody} onChange={setWantBody} />
    </Inline>}
    {!b.bodyweight.length && <div className="mb-4" style={{ borderBottom: '1px solid var(--sep)' }} />}

    {(w.converted || r.converted) && <div className="small ink-warn mb-5">
      {t('Hevy stores weights in kg, so they’ll be converted to {0}.', st.unit)}
    </div>}
    {wantWorkouts && (w.rirSets + w.rpeSets) > 0 && <div className="small dim mb-5">
      {effortLine(effortOf(st), w.rirSets || w.rpeSets, w.rirSets ? 'RIR' : 'RPE')}
    </div>}
    {unmatched.length > 0 && <>
      <SectionTitle>{t('Not in the library, so they’re added as your own exercises')}</SectionTitle>
      <div className="mchips mb-6">
        {unmatched.slice(0, 12).map(n => <span key={n} className="mchip capitalize">{n}</span>)}
        {unmatched.length > 12 && <span className="mchip">+{unmatched.length - 12}</span>}
      </div>
    </>}
  </BottomSheet>
}
