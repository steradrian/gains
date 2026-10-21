import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { todayISO } from '../../lib/format.js'
import { t, tn } from '../../lib/i18n.js'
import { MOBILE, shareExport, shareExportBlob } from '../../lib/mobile.js'
import { syncMedia, fetchToStore } from '../../lib/media-sync.js'
import { limitsFrom } from '../../lib/media-limits.js'
import { importFromApp, importFromHevy, confirmSheet, menuSheet } from '../../sheets.jsx'

/**
 * Export and import of the whole state, shared by Backup, Import and the sign-out confirms (which
 * offer a backup before they wipe the device). The functions are the ones Settings always had.
 */
export function useDataActions() {
  const toast = useUI(s => s.toast)
  const importBackup = useStore(s => s.importBackup)
  const importConflict = useStore(s => s.importConflict)

  // Reads the store at the moment of the tap: the sheet that asks before a sign-out offers it too,
  // and the copy it exports is the one that has not reached the server.
  const doExport = async () => {
    const json = JSON.stringify(useStore.getState().S, null, 2)
    const name = 'gains-backup-' + todayISO() + '.json'
    // WKWebView can't download blob URLs — the native build hands the file to the share sheet.
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }
  // "Export with photos & videos": the same JSON plus every file the state refers to, in a zip
  // (lib/backup-media.js). Signed in, a file this device never downloaded is fetched for it; one
  // nobody has is left out and counted. The sign-out sheet offers it while media are waiting.
  const doExportZip = async () => {
    const { exportBackupZip } = await import('../../lib/backup-media.js')
    const st = useStore.getState()
    const signedIn = !!(st.user && st.config?.media)
    let out
    try { out = await exportBackupZip(st.S, { fetchOne: signedIn ? fetchToStore : null }) }
    catch { toast(t('Something went wrong')); return }
    const name = 'gains-backup-' + todayISO() + '.zip'
    if (out.missing) toast(tn('{0} file could not be included', '{0} files could not be included', out.missing))
    if (MOBILE) {
      try { await shareExportBlob(out.blob, name); if (!out.missing) toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    if (!out.missing) toast(t('Backup exported'))
  }
  // Import takes the JSON backup and the zip alike, told apart by their first bytes. A zip's
  // files go into the local store only once the import is confirmed, each checked against its
  // name first; the state's media refs and links pass the usual gates (lib/backup-media.js).
  const doImport = async ev => {
    const f = ev.target.files[0]; if (!f) return
    ev.target.value = ''
    let read
    try {
      const { readBackupFile } = await import('../../lib/backup-media.js')
      read = await readBackupFile(f)
    } catch (e) {
      const { backupImportError } = await import('../../lib/backup-media.js')
      toast(backupImportError(e)); return
    }
    const apply = async mergeWith => {
      if (read.files.length) {
        const { storeBackupMedia } = await import('../../lib/backup-media.js')
        await storeBackupMedia(read.files, { limits: limitsFrom(useStore.getState().config) })
      }
      importBackup(read.state, { mergeWith })
      // The photos it brought are pending here and maybe gone from the server (a reset): sent now,
      // not after the ten-minute dedupe of the run before the reset.
      if (read.files.length) syncMedia({ force: true })
      toast(t('Backup imported'))
    }
    // Signed in, the server is asked first: a workout logged since the backup was made, or on
    // another device meanwhile, would be deleted from the profile by the replace — said, with the
    // choice to merge those in instead (useStore importConflict / importBackup).
    const conflict = await importConflict(read.state)
    if (conflict) {
      const n = conflict.workouts
      menuSheet({
        title: t('Import backup?'),
        subtitle: t(n === 1
          ? 'The server has 1 workout that is not in this backup, logged since it was made or on another device. Replacing deletes it.'
          : 'The server has {0} workouts that are not in this backup, logged since it was made or on another device. Replacing deletes them.', n),
        items: [
          { icon: 'trash', label: t('Replace anyway'), danger: true, onClick: () => apply(null) },
          { icon: 'merge', label: t('Merge them in'), onClick: () => apply(conflict) },
          { icon: 'xmark', label: t('Cancel'), onClick: () => {} },
        ],
      })
      return
    }
    confirmSheet({
      title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true,
      onConfirm: () => apply(null)
    })
  }

  return { doExport, doExportZip, doImport, importFromApp, importFromHevy }
}
