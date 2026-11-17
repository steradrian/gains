// Journal kind `photo-delete` (Me > Recent changes): a progress photo deleted from the viewer
// (views/me/photos/photo-delete.js, which keeps its own 8 s Undo). No UI imports.
//
//   snapshot: { source: 'own', entry } | { source: 'workout', w: { id?, d, start }, ref }, plus
//             `local` (this device had the file when it went) and `backup` (it is or was uploaded)
//   subject:  ''      facts: { source }     day: the photo's day
//
// The entry records the file's hashes (`media`), so the local media clean-up keeps them for the
// entry's 7 days, and the viewer's Undo holds them for its 8 s on top (mediaStore.hold). A restore
// puts the record back (the store stamps an own photo as added back over its tombstone) and
// answers `gone` only when this device had the file, it was never uploaded, and it has since gone.
import { recordChange, registerRestorer } from '../recent-changes.js'
import { referencedHashes } from '../media-refs.js'
import { mediaStore } from '../media-store.js'
import { syncMedia } from '../media-sync.js'
import { removePhoto, restorePhoto } from './photos.js'
import { addWorkoutMedia, removeWorkoutMedia } from '../workout-media.js'
import { syncNow } from '../nutrition/sync.js'
import { useStore } from '../../store/useStore.js'

export const PHOTO_DELETE = 'photo-delete'

const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))

/** Every file (and poster) the photo `went` (removePhoto's answer) refers to. */
export function photoHashes(went) {
  const ref = went?.source === 'own' ? went.entry?.ref : went?.ref
  return ref ? [...referencedHashes({ workouts: [{ media: [ref] }] })] : []
}

/** The snapshot of a deleted photo: `went` is removePhoto's answer, `photo` the allPhotos entry. */
export function photoSnapshot(went, photo, local) {
  const base = { local: local === true, backup: photo?.backup === true }
  return went.source === 'own'
    ? { ...base, source: 'own', entry: clone(went.entry) }
    : { ...base, source: 'workout', w: { id: went.w?.id, d: went.w?.d, start: went.w?.start }, ref: clone(went.ref) }
}

/** Journals a deleted photo; returns the entry's id (null when it could not be kept). */
export function recordPhotoDelete(snapshot, day) {
  return recordChange({
    kind: PHOTO_DELETE, day, subject: '', facts: { source: snapshot.source }, snapshot,
    media: photoHashes(snapshot.source === 'own' ? { source: 'own', entry: snapshot.entry } : snapshot),
  })
}

const refOf = snap => (snap.source === 'own' ? snap.entry?.ref : snap.ref)

/**
 * Puts the photo of `snap` back: { ok: true } or { ok: false, reason }: 'gone' (the file or the
 * workout is gone), 'replaced' (it is already back) or 'changed' (the workout is full).
 */
export async function putBackPhoto(snap) {
  const ref = refOf(snap || {})
  if (!ref?.hash || (snap.source !== 'own' && snap.source !== 'workout')) return { ok: false, reason: 'gone' }
  if (snap.local && !snap.backup && !(await mediaStore.has(ref.hash))) return { ok: false, reason: 'gone' }
  const { update } = useStore.getState()
  let result
  if (snap.source === 'own') update(s => { result = restorePhoto(s, snap.entry) ? 'added' : 'dup' })
  else update(s => { result = addWorkoutMedia(s, snap.w, ref) })
  if (result !== 'added') return { ok: false, reason: result === 'dup' ? 'replaced' : result === 'full' ? 'changed' : 'gone' }
  void syncNow()
  syncMedia({ force: true })
  return { ok: true, where: { day: snap.source === 'own' ? snap.entry.d : snap.w.d } }
}

/** Takes a restored photo out again. */
export async function takePhotoOut(snap) {
  const ref = refOf(snap || {})
  if (!ref?.hash) return { ok: false }
  let took = false
  useStore.getState().update(s => {
    took = snap.source === 'own'
      ? removePhoto(s, 'own:' + snap.entry.id) !== null
      : removeWorkoutMedia(s, snap.w, ref.hash)
  })
  if (took) void syncNow()
  return { ok: took }
}

registerRestorer(PHOTO_DELETE, { restore: putBackPhoto, undo: takePhotoOut })
