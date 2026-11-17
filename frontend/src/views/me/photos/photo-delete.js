import { mediaStore } from '../../../lib/media-store.js'
import { t } from '../../../lib/i18n.js'
import { photoHashes, photoSnapshot, putBackPhoto, recordPhotoDelete } from '../../../lib/me/photo-changes.js'
import { removePhoto } from '../../../lib/me/photos.js'
import { syncNow } from '../../../lib/nutrition/sync.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { confirmDrawer } from '../../settings/confirm-drawer.js'

// Deleting a progress photo from the viewer (board Me2Viewer): the confirm, the removal, and the
// Undo. The removal is the photo's own (lib/me/photos.js removePhoto: an own photo leaves a
// tombstone so the sync takes it off the other devices, a workout's comes off its workout), and it
// is journalled as `photo-delete` (Recent changes keeps the files for 7 days). For the Undo's own
// 8 s the files are held in the media store: the local clean-up runs 10 s after a change and
// would otherwise take them the moment the photo stops being referenced.

/** Asks, then deletes. `onDeleted` runs once the photo is gone (the viewer closes itself). */
export function confirmDeletePhoto(photo, onDeleted) {
  const workout = photo.source === 'workout'
  confirmDrawer({
    title: t('Delete this photo?'),
    body: workout ? t('This photo goes from your photos. Photos in a workout leave that workout too.') : t('This photo goes from your photos.'),
    note: photo.backup ? t('It is also removed from your backup.') : undefined,
    confirmLabel: t('Delete photo'),
    onConfirm: () => { void deletePhoto(photo).then(done => { if (done) onDeleted?.() }) },
  })
}

/** Deletes `photo` (an allPhotos entry) and offers Undo. Resolves whether anything went. */
export async function deletePhoto(photo) {
  const hash = photo.ref.hash
  const local = await mediaStore.has(hash).catch(() => false)
  let went = null
  useStore.getState().update(s => { went = removePhoto(s, photo.key) })
  if (!went) return false
  const release = mediaStore.hold(photoHashes(went))
  const snapshot = photoSnapshot(went, photo, local)
  recordPhotoDelete(snapshot, photo.d)
  void syncNow()
  useUI.getState().toast(t('Photo deleted'), {
    action: t('Undo'), onAction: () => { void undoDelete(snapshot) }, onClose: release,
  })
  return true
}

async function undoDelete(snapshot) {
  const res = await putBackPhoto(snapshot)
  // Already back (replaced) is what Undo wanted; anything else is said plainly.
  if (!res.ok && res.reason !== 'replaced') useUI.getState().toast(t('Couldn’t restore that photo'))
}
