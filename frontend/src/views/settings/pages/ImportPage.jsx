import { useRef } from 'react'
import { t } from '../../../lib/i18n.js'
import { Section, Row } from '../../../components/ui.jsx'
import { useDataActions } from '../use-data-actions.js'

export default function ImportPage() {
  const importRef = useRef(null)
  const { importFromApp, importFromHevy } = useDataActions()
  return <>
    <Section title={t('Bring data in')}>
      <Row icon="download" iconTint="var(--teal)" title={t('Import from another app')}
        subtitle={t('FitNotes, Strong, Hevy, or body weight from Apple Health')}
        accessory="chevron" onClick={() => importRef.current.click()} />
      <Row icon="key" iconTint="var(--teal)" title={t('Import from Hevy')}
        subtitle={t('Pull your history with a Hevy Pro API key')}
        accessory="chevron" onClick={importFromHevy} />
    </Section>
    {/* Reset after reading so picking the same file twice still fires onChange. */}
    <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
      onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />
  </>
}
