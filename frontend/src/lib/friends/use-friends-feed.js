import { useMemo } from 'react'
import { friendsAvailable } from './api.js'
import { isMockFriends } from './store.js'
import { useCheers } from './use-cheers.js'
import { useFriendsMe } from './use-friends.js'

// What the Notifications feed reads of Friends (feed.js `friends`): the cheers and the open
// invitations from the cached copies, null while Friends is off or unavailable. Reading mounts the
// same refreshers as the Friends screens (mount, focus, every 60 s), so the notifications page
// itself makes no request of its own.
//
// An invitation has to have a time to sit in the feed and to be read once. The server's `at` is
// used when it sends one; otherwise the first time this device saw the invite, kept in
// localStorage (try/catch) and dropped once the invite is gone.

const KEY = 'gains_friends_invite_seen'
let mockTimes = {}

const readTimes = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}

/** `keys` mapped to the time each was first seen (now for a new one); anything not in `keys` is forgotten. */
export function firstSeen(keys, now = Date.now()) {
  const mock = isMockFriends()
  const before = mock ? mockTimes : readTimes()
  const next = {}
  for (const k of keys) next[k] = Number.isFinite(before[k]) ? before[k] : now
  if (mock) mockTimes = next
  else if (JSON.stringify(next) !== JSON.stringify(before)) {
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode: seen again next time */ }
  }
  return next
}

export function __resetFirstSeen() {
  mockTimes = {}
}

/** `{ cheers, invitations, challengeInvites }` with every `at` in ms, or null when Friends is off. */
export function useFriendsFeed() {
  const { me, on } = useFriendsMe()
  const { cheers } = useCheers()
  return useMemo(() => {
    if (!on || !me || !friendsAvailable()) return null
    const invitations = Array.isArray(me.invitations) ? me.invitations : []
    const challengeInvites = Array.isArray(me.challengeInvites) ? me.challengeInvites : []
    const seen = firstSeen([
      ...invitations.map(i => 'group-invite:' + i.code),
      ...challengeInvites.map(c => 'challenge:' + c.cid),
    ])
    const stamp = (at, key) => (Number.isFinite(Date.parse(at)) ? Date.parse(at) : seen[key])
    return {
      cheers: cheers || [],
      invitations: invitations.map(i => ({ ...i, at: stamp(i.at, 'group-invite:' + i.code) })),
      challengeInvites: challengeInvites.map(c => ({ ...c, at: stamp(c.at, 'challenge:' + c.cid) })),
    }
  }, [me, on, cheers])
}
