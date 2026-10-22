import { useEffect, useSyncExternalStore } from 'react'
import { useStore } from '../../store/useStore.js'
import { friendsAvailable, leaveGroup as leaveGroupRequest, putMe } from './api.js'
import { cacheMe, getFriends, refreshFriends, subscribeFriends, watchFriends } from './store.js'

// The hooks screens read Friends through, and the writes they make. A write throws a FriendsError
// for the caller to toast (friendsErrorText); on success the cache is refetched so every screen
// agrees. Mounting a hook starts the refresh (store.js watchFriends): a screen that only wants
// the data on show (the Me row) passes nothing special, it is the same watch.

const useSnapshot = () => useSyncExternalStore(subscribeFriends, getFriends, getFriends)

function useWatch() {
  const signedIn = useStore(s => !!s.user)
  useEffect(() => (friendsAvailable() ? watchFriends() : undefined), [signedIn])
}

/** `{ me, status, stale, offline, on, ready }`: GET /me. `stale` is last data after a failed refresh. */
export function useFriendsMe() {
  useWatch()
  const s = useSnapshot()
  return { me: s.me, status: s.status, stale: s.stale, offline: s.offline, on: !!s.me?.on, ready: !!s.me }
}

/** `{ groups, status, stale, offline, ready }`: GET /groups, in the order the server keeps. */
export function useGroups() {
  useWatch()
  const s = useSnapshot()
  return { groups: s.groups || [], status: s.status, stale: s.stale, offline: s.offline, ready: !!s.groups }
}

/** Turns Friends on with what to share (`share` is the four switches); refused `needs-share` without any. */
export async function turnOn(share) {
  cacheMe(await putMe({ on: true, share }))
  await refreshFriends()
}

/** Turns Friends off: nothing is shared and nobody sees you, memberships are kept. */
export async function turnOff() {
  cacheMe(await putMe({ on: false }))
  await refreshFriends()
}

/** Leaves a group (no Undo, R5); the last member leaving deletes it. */
export async function leaveGroup(id) {
  await leaveGroupRequest(id)
  await refreshFriends()
}
