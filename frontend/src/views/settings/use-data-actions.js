import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { todayISO } from '../../lib/format.js'
import { t, tn } from '../../lib/i18n.js'
import { MOBILE, shareExport, shareExportBlob } from '../../lib/mobile.js'
import { syncMedia, fetchToStore } from '../../lib/media-sync.js'
import { limitsFrom } from '../../lib/media-limits.js'
import { confirmSheet, menuSheet } from '../../sheets.jsx'

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
  // The file is built apart from being handed over: "Download my data" builds it, then saves it
  // on a tap of its own (a download started after a long await is not a user gesture, and Safari
  // refuses it). `file` is { name, json } or { name, blob, missing }.
  const buildJson = () => ({ name: 'gains-backup-' + todayISO() + '.json', json: JSON.stringify(useStore.getState().S, null, 2) })
  // "Export with photos & videos": the same JSON plus every file the state refers to, in a zip
  // (lib/backup-media.js). Signed in, a file this device never downloaded is fetched for it; one
  // nobody has is left out and counted. The sign-out sheet offers it while media are waiting.
  const buildZip = async () => {
    const { exportBackupZip } = await import('../../lib/backup-media.js')
    const st = useStore.getState()
    const signedIn = !!(st.user && st.config?.media)
    let out
    try { out = await exportBackupZip(st.S, { fetchOne: signedIn ? fetchToStore : null }) }
    catch { toast(t('Something went wrong')); return null }
    if (out.missing) toast(tn('{0} file could not be included', '{0} files could not be included', out.missing))
    return { name: 'gains-backup-' + todayISO() + '.zip', blob: out.blob, missing: out.missing }
  }
  // True once it is saved; false when the share sheet was dismissed.
  const saveFile = async file => {
    // WKWebView can't download blob URLs — the native build hands the file to the share sheet.
    if (MOBILE) {
      try { await (file.blob ? shareExportBlob(file.blob, file.name) : shareExport(file.json, file.name)); return true } catch (e) { return false /* share sheet dismissed */ }
    }
    const blob = file.blob || new Blob([file.json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    return true
  }
  const doExport = async () => { if (await saveFile(buildJson())) toast(t('Backup exported')) }
  const doExportZip = async () => {
    const file = await buildZip()
    if (file && await saveFile(file) && !file.missing) toast(t('Backup exported'))
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

  return { doExport, doExportZip, buildJson, buildZip, saveFile, doImport }
}
