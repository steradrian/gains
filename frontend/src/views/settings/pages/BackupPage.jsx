import { useRef } from 'react'
import { useStore } from '../../../store/useStore.js'
import { t } from '../../../lib/i18n.js'
import { MOBILE } from '../../../lib/mobile.js'
import BackupFolderRow, { useBackupFolder, autoBackupSubtitle } from '../../../components/BackupFolderRow.jsx'
import { Section, Row, Switch } from '../../../components/ui.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { useDataActions } from '../use-data-actions.js'

// One backup of everything Gains keeps, and the way back from it.
export default function BackupPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const { android, hasMedia } = useSettingsCtx()
  const { doExport, doExportZip, doImport } = useDataActions()
  const fileRef = useRef(null)
  // Where auto-backup writes on this Android phone, for the Auto-backup row's own subtitle.
  const [backupDir] = useBackupFolder(MOBILE && android && !!S.autoBackup)
  return <>
    <Section title={t('Back up')}>
      <Row icon="share" iconTint="var(--blue)" title={t('Export backup (JSON)')} subtitle={hasMedia ? t('Without photos and videos') : undefined} accessory="chevron" onClick={doExport} />
      {hasMedia && <Row icon="share" iconTint="var(--blue)" title={t('Export with photos & videos (.zip)')} accessory="chevron" onClick={doExportZip} />}
      {/* 14 is AUTO_BACKUP_KEEP in lib/mobile.js, written out because the Settings tests mock
          that module wholesale; mobile.autobackup.test.js pins the two together. */}
      {MOBILE && <Row icon="folder" iconTint="var(--blue)" title={t('Auto-backup on changes')}
        subtitle={autoBackupSubtitle(android && S.autoBackup ? backupDir : null, 14)}>
        <Switch checked={!!S.autoBackup} onChange={v => update(s => { s.autoBackup = v })} />
      </Row>}
      {/* Android only: the system folder picker (#161). iOS shows Documents in Files already. */}
      {MOBILE && android && S.autoBackup && <BackupFolderRow />}
    </Section>
    <Section title={t('Restore')}>
      <Row icon="download" iconTint="var(--teal)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
    </Section>
    <input ref={fileRef} type="file" accept=".json,.zip,application/json,application/zip" style={{ display: 'none' }} onChange={doImport} />
  </>
}
