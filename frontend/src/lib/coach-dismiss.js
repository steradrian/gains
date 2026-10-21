// Dismissing the Coach's suggestions with Undo instead of a confirm (PR02 T11.0, T11.3; owner
// question 7). The suggestions hide at once; nothing is recorded or sent until the Undo toast's
// window (TOAST_ACTION_MS, 8 s) closes. Undo inside the window clears the flag and sends nothing.
//
// The pending dismissal lives in memory only. A reload or an app close inside the window drops
// it: nothing was recorded or sent, so the suggestions are simply there again, still pending on
// the server or the phone, and can be dismissed again. That is the safe side of the two: a
// dismissal committed on the way out could not be undone by anyone.
import { create } from 'zustand'
import { useStore } from '../store/useStore.js'
import { TOAST_ACTION_MS } from '../store/useUI.js'
import { appendChat, recordDismissal } from './coach.js'
import { resolvePending } from './coach-api.js'
import { t } from './i18n.js'

// The id of the proposal waiting out its window, or null. One proposal is pending at a time, so
// one dismissal can be.
const usePending = create(() => ({ id: null }))
let timer = null
let waiting = null

function commit(proposal, onCommit) {
  useStore.getState().update(s => {
    const ref = recordDismissal(s, proposal)
    appendChat(s, {
      role: 'coach', kind: 'dismissed', ref,
      text: proposal.kind === 'create'
        ? t('Discarded. Tell me what was off and I will build a different one.')
        : t('Got it. I won’t suggest these again without new evidence.')
    })
  })
  resolvePending({ dismissed: true }).catch(() => {})
  if (onCommit) onCommit()
}

function settle() {
  clearTimeout(timer)
  timer = null
  waiting = null
  usePending.setState({ id: null })
}

/**
 * Hides `proposal`'s suggestions now and dismisses them for real (recordDismissal, then
 * resolvePending({ dismissed: true })) when the window closes without an Undo. `onCommit` runs
 * after that, for the caller to refresh. A second dismissal while one waits commits the first
 * at once.
 *
 * Returns `{ count, undo }`: how many suggestions went (for "Dismissed {0} suggestions"), and
 * `undo()`, true when it took the dismissal back, false once the window had closed.
 */
export function dismissWithUndo(proposal, { onCommit } = {}) {
  if (waiting) {
    const { proposal: earlier, onCommit: then } = waiting
    settle()
    commit(earlier, then)
  }
  const mine = { proposal, onCommit }
  waiting = mine
  usePending.setState({ id: proposal.id })
  timer = setTimeout(() => {
    if (waiting !== mine) return
    settle()
    commit(proposal, onCommit)
  }, TOAST_ACTION_MS)
  return {
    count: (proposal.changes || []).length,
    undo: () => {
      if (waiting !== mine) return false
      settle()
      return true
    }
  }
}

/** Whether the proposal `id` is hidden, waiting out its Undo window. */
export const isDismissPending = id => !!id && usePending.getState().id === id
/** The same, as a hook, so the Coach page hides the suggestions while the toast shows. */
export const useDismissPending = id => usePending(s => !!id && s.id === id)
