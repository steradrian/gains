import { useRef, useState } from 'react'
import { friendsErrorText, putMe } from '../../lib/friends/api.js'
import { cacheMe } from '../../lib/friends/store.js'
import { turnOn, useFriendsMe } from '../../lib/friends/use-friends.js'
import { useUI } from '../../store/useUI.js'

/** What a person shares until they choose otherwise: New bests is off, one by one from a summary. */
export const DEFAULT_SHARE = { training: true, consistency: true, targets: true, bests: false }

const toast = msg => useUI.getState().toast(msg)

/**
 * The What you share editor's state. While Friends is off (`confirming`) the switches only change a
 * local draft: nothing is sent or stored until `confirm()` turns Friends on with it. Once it is on,
 * every switch writes through PUT /me at once; the draft shows the new value until the answer
 * lands, and a refused write puts the old value back and says so.
 */
export function useSharing() {
  const { me, on, ready, stale } = useFriendsMe()
  const [draft, setDraft] = useState(null)
  const [turning, setTurning] = useState(false)
  const latest = useRef(0)
  const share = draft ?? me?.share ?? DEFAULT_SHARE

  const setSwitch = async (key, value) => {
    const next = { ...share, [key]: value }
    setDraft(next)
    if (!on) return
    const mine = ++latest.current
    try {
      cacheMe(await putMe({ share: next }))
    } catch (e) {
      toast(friendsErrorText(e))
    }
    if (mine === latest.current) setDraft(null)
  }

  /** Turns Friends on with the draft. Resolves true when it is on. */
  const confirm = async () => {
    if (turning) return false
    setTurning(true)
    try {
      await turnOn(share)
      return true
    } catch (e) {
      toast(friendsErrorText(e))
      return false
    } finally {
      setTurning(false)
    }
  }

  return { ready, on, confirming: ready && !on, stale, share, setSwitch, confirm, turning }
}
