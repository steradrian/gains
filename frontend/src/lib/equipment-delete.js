// Deleting an equipment profile with an Undo in place of a confirm (T12.1, PR02 owner decision:
// the toast puts it back). Needs the store; lib/equipment.js stays pure.
import { useStore } from '../store/useStore.js'

/**
 * Removes the profile `id`. When it was the active one, the first profile left becomes active
 * (null with none). Returns `{ profile, undo }`, or null for an id that is not a profile, and
 * nothing changes.
 *
 * `undo()` puts the profile back where it was in the list, and makes it the active one again
 * unless another has been picked since. It returns true once it did; false after that, and when
 * a profile with that id is already back (another device's Undo).
 */
export function deleteProfileWithUndo(id) {
  const store = useStore.getState()
  const index = (store.S.equipProfiles || []).findIndex(p => p.id === id)
  if (index < 0) return null
  const profile = structuredClone(store.S.equipProfiles[index])
  const wasActive = store.S.activeEquipId === id
  let fallback = null
  store.update(s => {
    s.equipProfiles = s.equipProfiles.filter(p => p.id !== id)
    if (wasActive) {
      fallback = s.equipProfiles[0]?.id || null
      s.activeEquipId = fallback
    }
  })
  let done = false
  const undo = () => {
    if (done) return false
    done = true
    let back = false
    useStore.getState().update(s => {
      s.equipProfiles = s.equipProfiles || []
      if (s.equipProfiles.some(p => p.id === id)) return
      s.equipProfiles.splice(Math.min(index, s.equipProfiles.length), 0, structuredClone(profile))
      if (wasActive && (s.activeEquipId || null) === fallback) s.activeEquipId = id
      back = true
    })
    return back
  }
  return { profile, undo }
}
