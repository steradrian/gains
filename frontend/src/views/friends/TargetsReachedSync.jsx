import { useTargetsReachedActive, useTargetsReachedSync } from '../../lib/friends/use-targets-reached-sync.js'

// The writer is its own component so the diary is read only while it is mounted.
function Writer() {
  useTargetsReachedSync()
  return null
}

/** Mounted once in the app shell: keeps S.targetsReached current while Friends and its targets switch are on. */
export default function TargetsReachedSync() {
  return useTargetsReachedActive() ? <Writer /> : null
}
