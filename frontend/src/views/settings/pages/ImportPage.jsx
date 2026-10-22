import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { importHevyData } from '../../../lib/import-hevy.js'
import { importFromApp, showHevyPreview } from '../../../sheets.jsx'
import StageNote from '../../../ds/StageNote.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { Card } from './prefs-rows.jsx'
import { openHevyKeySheet } from './hevy-key-sheet.jsx'
import ImportDoneScreen from './ImportDoneScreen.jsx'
import ImportProgressScreen from './ImportProgressScreen.jsx'
import { hevyFetchError, hevyFraction, hevyProgressLabel } from './import-progress.js'

const CSV = '.csv,text/csv'
const XML = '.xml,text/xml'
// What each source's file is called in its own app; the importer sniffs the real format
// (lib/import-csv.js parseImport), so the row only picks which files the picker offers.
const sources = () => [
  { title: t('Strong'), icon: 'download', sub: t('Export Data, as a .csv'), accept: CSV },
  { title: t('Hevy'), icon: 'download', sub: t('Export & Import Data, as a .csv'), accept: CSV },
  { title: t('FitNotes'), icon: 'download', sub: t('Spreadsheet Export, as a .csv'), accept: CSV },
  { title: t('Gravl'), icon: 'download', sub: t('Export Data, as a .csv'), accept: CSV },
  { title: t('Apple Health'), icon: 'heart', sub: t('Body weight only, from export.xml'), accept: XML },
  { title: t('Your own CSV'), icon: 'download', sub: t('A date, an exercise and something measured'), accept: CSV },
]

// Import (boards St1Import to St1Imported). A file is read and shown for confirming before
// anything is written (sheets/import.jsx); existing days always win, so importing twice never
// duplicates. Only Hevy's fetch takes time, and only it has the progress screen.
export default function ImportPage() {
  const nav = useNavigate()
  const fileRef = useRef(null)
  // Which Hevy fetch is the current one. Leaving the page (or Cancel) moves it on, so a result
  // that arrives later is dropped instead of opening a sheet over some other page.
  const run = useRef(0)
  const [phase, setPhase] = useState(null)
  useEffect(() => () => { run.current += 1 }, [])

  const pick = accept => {
    fileRef.current.accept = accept
    fileRef.current.click()
  }
  // Reset after reading so picking the same file twice still fires onChange.
  const onFile = ev => {
    const f = ev.target.files[0]
    ev.target.value = ''
    if (f) importFromApp(f, { onImported: outcome => setPhase({ kind: 'done', outcome }) })
  }

  const fetchHevy = async key => {
    const id = ++run.current
    const live = () => run.current === id
    const progress = p => setPhase({ kind: 'progress', source: 'Hevy', label: hevyProgressLabel(p), fraction: hevyFraction(p) })
    const { S } = useStore.getState()
    progress(null)
    try {
      const data = await importHevyData(key, { unit: S.unit, customEx: S.customEx, onProgress: p => { if (live()) progress(p) } })
      if (!live()) return
      setPhase(null)
      if (!data.workouts.workouts.length && !data.routines.routines.length && !data.bodyweight.bodyweight.length) {
        useUI.getState().toast(t('Nothing to import from Hevy'))
        return
      }
      showHevyPreview(data, { onImported: outcome => setPhase({ kind: 'done', outcome }) })
    } catch (e) {
      if (!live()) return
      setPhase(null)
      useUI.getState().toast(hevyFetchError(e))
    }
  }

  if (phase?.kind === 'progress') {
    return <ImportProgressScreen source={phase.source} label={phase.label} fraction={phase.fraction}
      onCancel={() => { run.current += 1; setPhase(null) }} />
  }
  if (phase?.kind === 'done') return <ImportDoneScreen outcome={phase.outcome} onOpen={nav} />

  return (
    <SettingsPage title={t('Import')} line={t('Workouts, routines, weigh-ins')}>
      <>
        <StageNote>{t('Exercise names are matched to the library; anything new becomes your own exercise. Days that already have a workout are left alone, so importing twice never duplicates.')}</StageNote>
        <StageSection title={t('From a file')} />
        <Card>
          {sources().map(s => <SettingRow key={s.accept + s.title} icon={s.icon} title={s.title} sub={s.sub} onClick={() => pick(s.accept)} />)}
        </Card>
        <StageSection title={t('Directly')} />
        <Card>
          <SettingRow icon="key" title={t('Import from Hevy')} sub={t('Hevy Pro API key · workouts, routines, weigh-ins')} onClick={() => openHevyKeySheet(fetchHevy)} />
        </Card>
        <StageNote>{t('Importing history never changes your schedule. Hevy routines are added only if you switch them on.')}</StageNote>
      </>
      <input ref={fileRef} type="file" hidden onChange={onFile} />
    </SettingsPage>
  )
}
