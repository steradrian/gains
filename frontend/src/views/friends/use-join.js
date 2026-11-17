import { useCallback, useEffect, useState } from 'react'
import { friendsErrorText, getJoinPreview, joinGroup } from '../../lib/friends/api.js'
import { refreshFriends } from '../../lib/friends/store.js'
import { useUI } from '../../store/useUI.js'

const CLOSED = new Set(['used', 'expired', 'revoked'])
const CLOSED_CODES = new Set(['invite-used', 'invite-expired', 'not-found'])

const toast = msg => useUI.getState().toast(msg)

/**
 * The join page's state for an invite `code` (GET /join/{code}), as one of:
 * `loading`; `valid` (`preview` has the group and who invited); `member` (already in: `groupId`);
 * `closed` (used, expired, revoked or unknown: `from` is the inviter's name when the server gave
 * one); `error` (nothing answered or the server refused: Try again). `join()` redeems the invite
 * and resolves `{ groupId }` on success, or `null` after changing the phase or toasting why not.
 */
export function useJoin(code) {
  const [phase, setPhase] = useState({ kind: 'loading' })
  const [joining, setJoining] = useState(false)

  const load = useCallback(() => {
    let gone = false
    setPhase({ kind: 'loading' })
    getJoinPreview(code).then(p => {
      if (gone) return
      if (p.status === 'valid') setPhase({ kind: 'valid', preview: p })
      else if (p.status === 'member' && p.group?.id) setPhase({ kind: 'member', groupId: p.group.id })
      else if (CLOSED.has(p.status)) setPhase({ kind: 'closed', from: p.from?.name || null })
      else setPhase({ kind: 'closed', from: null })
    }).catch(e => {
      if (gone) return
      if (CLOSED_CODES.has(e.code) || e.status === 404) { setPhase({ kind: 'closed', from: null }); return }
      if (e.code === 'rate-limited') toast(friendsErrorText(e))
      setPhase({ kind: 'error' })
    })
    return () => { gone = true }
  }, [code])

  useEffect(() => load(), [load])

  const join = async () => {
    if (joining) return null
    setJoining(true)
    try {
      const group = await joinGroup(code)
      refreshFriends().catch(() => {})
      return { groupId: group.id }
    } catch (e) {
      if (e.code === 'already-member' && e.data?.group?.id) setPhase({ kind: 'member', groupId: e.data.group.id })
      else if (e.code === 'invite-used' || e.code === 'invite-expired') {
        setPhase(prev => ({ kind: 'closed', from: prev.preview?.from?.name || null }))
      } else toast(friendsErrorText(e))
      return null
    } finally {
      setJoining(false)
    }
  }

  return { phase, joining, join, retry: load }
}
