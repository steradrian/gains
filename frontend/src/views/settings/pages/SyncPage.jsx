import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { t } from '../../../lib/i18n.js'
import { fmtAgo, changeCount } from '../../../lib/format.js'
import { DEMO } from '../../../lib/demo.js'
import { MOBILE } from '../../../lib/mobile.js'
import { nutritionAvailable } from '../../../lib/nutrition/api.js'
import { isHubTrouble, syncNow as hubSyncNow, useHubStatusRefresh, useHubSync } from '../../../lib/nutrition/sync.js'
import {
  connectionView, actionLabel, hostOf, useOnline, useKeptChanges, keptChangesSheet,
  connectServer, signInAgain, pairAgain,
} from '../../../components/ServerSync.jsx'
import { CfAccessSheet } from '../../MobileOnboarding.jsx'
import StageSection from '../../../ds/StageSection.jsx'
import SettingRow from '../SettingRow.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { useSettingsCtx } from '../use-settings-ctx.js'
import { useDataActions } from '../use-data-actions.js'
import BackupFolderRows, { useBackupFolder, autoBackupSubtitle } from './backup-folder.jsx'
import { fileSize, fmtSize, canShareFile, shareFile } from './backup-share.js'
import { Card, SwitchRow } from './prefs-rows.jsx'

// The hub's Gains ↔ NutriTrace sync, in words (fitness-hub src/sync/engine.ts SyncState).
function hubView(status) {
  if (!status) return { icon: 'cloud', line: t('Not synced yet') }
  switch (status.state) {
    case 'ok': return { icon: 'cloud', line: t('All synced') }
    case 'syncing': return { icon: 'reset', line: t('Syncing…') }
    case 'retrying': return { icon: 'reset', line: t('Trying again soon') }
    case 'needs_confirmation': return { icon: 'warning', line: t('Waiting for your confirmation') }
    case 'suspended': return { icon: 'warning', line: t('Paused') }
    default: return { icon: 'warning', line: t('Nutrition sync needs attention') }
  }
}

// How the server stands, in a word for the Server row's end.
const connectedWord = tone => ({ ok: t('Connected'), off: t('Offline'), wait: t('Waiting'), bad: t('Needs attention') })[tone]

// Sync and backup (boards St1Sync, St1SyncWaiting, St1Backup): where Gains stands with the
// server and NutriTrace, one Sync now for both, the way to take everything out as a file and the
// way back in. Everything is saved on this device first; the server only has to catch up.
export default function SyncPage() {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  useStore(s => s.config)   // whether "Sign in" may offer a password
  const unsynced = useStore(s => s.unsyncedChanges)
  const hub = useHubSync(s => s.status)
  const online = useOnline()
  const { android, hasMedia } = useSettingsCtx()
  const { buildJson, buildZip, saveFile, doImport } = useDataActions()
  const kept = useKeptChanges()
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  // "Last synced 3 minutes ago" goes stale on an open screen; a re-render now and then keeps it true.
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(iv) }, [])
  useHubStatusRefresh()
  // Where auto-backup writes on this Android phone, for the Auto-backup row's own subtitle.
  const [backupDir] = useBackupFolder(MOBILE && android && !!S.autoBackup)

  const nutrition = !!user && nutritionAvailable(user)
  const view = !DEMO && sync ? connectionView(sync, { online }) : null
  const hv = hubView(hub)

  // Gains first (the hub reads the change from there), so the hub run need not push again.
  const now = async () => {
    if (busy) return
    setBusy(true)
    try {
      const st = await useStore.getState().syncNow()
      const trainingView = connectionView(st)
      // A training sync that failed says so first; then the hub's half: no answer, or a state that
      // needs the person, is not "All synced".
      let line = trainingView?.line
      if (nutrition && trainingView?.tone === 'ok') {
        const hubStatus = await hubSyncNow({ pushed: true })
        if (!hubStatus) line = t('Training synced, but nutrition did not: the sync service did not answer.')
        else if (isHubTrouble(hubStatus)) line = t('Nutrition sync needs attention')
      }
      if (line) useUI.getState().toast(line)
    } finally {
      setBusy(false)
    }
  }

  // "Backup exported", with the file's name and size, and Share to hand the file on. The native
  // build already showed its share sheet to save the file, so Share there opens it again.
  const announce = file => {
    const canShare = MOBILE || canShareFile(file)
    useUI.getState().toast(t('Backup exported'), {
      body: file.name + ' · ' + fmtSize(fileSize(file)),
      ...(canShare ? { action: t('Share'), onAction: () => (MOBILE ? saveFile(file) : shareFile(file)) } : null),
    })
  }
  const exportJson = async () => {
    const file = buildJson()
    if (await saveFile(file)) announce(file)
  }
  // A file the zip had to leave out was already counted by buildZip's own toast; this one would
  // replace it.
  const exportZip = async () => {
    const file = await buildZip()
    if (file && await saveFile(file) && !file.missing) announce(file)
  }

  // What the status says when it is not fine and something can be done about it from here.
  const fix = view && ({ connect: connectServer, signin: signInAgain, pair: pairAgain })[view.action]
  // While everything is fine, a change still in its short debounce is not news; once anything is
  // wrong (or the device is offline), how much is waiting is what the person needs. The store
  // knows how many changes, not their names, so the hero counts them and lists none.
  const owed = view && view.tone !== 'ok' && typeof unsynced === 'function' ? unsynced() : { owed: false }
  const waiting = owed.owed && owed.count > 0 ? owed.count : 0
  const host = sync?.server ? hostOf(sync.server) : ''
  const heroSub = !view ? null
    : view.tone === 'ok'
      ? (sync.lastSynced ? (host ? t('Last synced {0} with {1}', fmtAgo(sync.lastSynced), host) : t('Last synced: {0}', fmtAgo(sync.lastSynced))) : t('Not synced with this server yet'))
      : [view.banner, owed.owed && owed.count == null ? t('Some changes on this device have not reached your server.') : null].filter(Boolean).join(' ')
  const signedIn = !!user && view && sync.status !== 'local'

  return (
    <SettingsPage title={t('Sync and backup')} line={t('Saved on this device first, then the server')}>
      <div className="set-body">
        {view && <>
          <Card>
            <SettingRow icon={view.icon} title={waiting ? t('{0} waiting', changeCount(waiting)) : view.line} sub={heroSub || undefined} />
            {signedIn && <SettingRow icon="reset" title={busy ? t('Syncing…') : t('Sync now')} onClick={now} />}
            {!signedIn && fix && <SettingRow icon={view.action === 'connect' ? 'globe' : 'lock'} title={actionLabel(view)} onClick={fix} />}
          </Card>

          {signedIn && <>
            <StageSection title={t('Server')} />
            <Card>
              <SettingRow icon="globe" title={host || t('Server address unknown')} sub={t('Signed in as {0}', user.name)} value={connectedWord(view.tone)} />
              {MOBILE && <SettingRow icon="key" title={t('Cloudflare Access')} onClick={() => useUI.getState().openSheet(close => <CfAccessSheet close={close} server={sync.server || ''} />)} />}
              {sync.status === 'auth' && fix && <SettingRow icon={MOBILE ? 'qr' : 'key'} title={actionLabel(view)}
                sub={MOBILE ? t('Your changes are kept here, and merged into your account once it is paired again.') : t('Your changes are kept here, and merged into your account once you are signed in again.')}
                onClick={fix} />}
              {nutrition && <SettingRow icon={hv.icon} title={t('Nutrition')}
                sub={hub?.last_synced_at ? t('Last synced: {0}', fmtAgo(hub.last_synced_at)) : t('Diary, foods and water sync too')} value={hv.line} />}
            </Card>
          </>}
        </>}

        {!DEMO && kept.length > 0 && <>
          <StageSection title={t('Kept on this device')} />
          <Card>
            {kept.map(k => <SettingRow key={(k.server || '') + '|' + k.uid} icon="history" title={t('Changes kept for {0}', k.name || k.uid)}
              sub={(k.server ? hostOf(k.server) + ' · ' : '') + t('Added back when this device connects as that account again.')}
              onClick={() => keptChangesSheet(k)} />)}
          </Card>
        </>}

        <StageSection title={t('Backup')} />
        <Card>
          <SettingRow icon="share" title={t('Export backup')} sub={hasMedia ? t('Without photos and videos') : t('Everything, one JSON file')} onClick={exportJson} />
          {hasMedia && <SettingRow icon="share" title={t('Export with photos and videos')} sub={t('A .zip, larger')} onClick={exportZip} />}
          {/* 14 is AUTO_BACKUP_KEEP in lib/mobile.js, written out because the Settings tests mock
              that module wholesale; mobile.autobackup.test.js pins the two together. */}
          {MOBILE && <SwitchRow icon="folder" title={t('Auto-backup on changes')}
            sub={autoBackupSubtitle(android && S.autoBackup ? backupDir : null, 14)}
            checked={!!S.autoBackup} onChange={v => update(s => { s.autoBackup = v })} />}
          {/* Android only: the system folder picker (#161). iOS shows Documents in Files already. */}
          {MOBILE && android && S.autoBackup && <BackupFolderRows />}
          <SettingRow icon="download" title={t('Import backup')} sub={t('From a Gains .json or .zip')} onClick={() => fileRef.current.click()} />
        </Card>
      </div>
      <input ref={fileRef} type="file" hidden accept=".json,.zip,application/json,application/zip" onChange={doImport} />
    </SettingsPage>
  )
}
