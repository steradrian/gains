import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { appendChat } from '../../../lib/coach.js'
import { t } from '../../../lib/i18n.js'
import { listChanges, pruneChanges, restoreChange, subscribeChanges, undoRestore } from '../../../lib/recent-changes.js'
import '../../../lib/recent-changes-kinds.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import { failureMessage, groupByDay, isAlready, isUndo, restoredMessage } from './changes-data.js'

// The view model of Recent changes: the journal's last 7 days grouped by day, kept live (a restore,
// or a change made while the page is open, relists), and the Restore flow with its toasts. The
// journal is pruned on open. Entries that were already back are remembered for as long as the page
// is open. No JSX.
//
// restore(entry) resolves true when the entry is back (restored, or already back), false when the
// row stays.
export const REAL_JOURNAL = { list: listChanges, prune: pruneChanges, restore: restoreChange, undo: undoRestore, subscribe: subscribeChanges }

// `journal` is the journal's five functions; the screens gallery passes an in-memory one so a mock
// never touches the real entries.
export function useChanges(journal = REAL_JOURNAL) {
  const S = useStore(s => s.S)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(() => new Set())
  const [already, setAlready] = useState(() => new Set())
  const inflight = useRef(new Set())

  useEffect(() => {
    journal.prune()
    setVersion(v => v + 1)
    return journal.subscribe(() => setVersion(v => v + 1))
  }, [journal])

  // `S` is a dependency because the Coach's entries are read from it, not copied.
  const entries = useMemo(() => journal.list(), [journal, version, S])
  const days = useMemo(() => groupByDay(entries), [entries])
  const restoredIds = useMemo(() => new Set(entries.filter(e => e.state === 'restored').map(e => e.id)), [entries])

  const setBusyOf = useCallback((id, on) => {
    setBusy(prev => {
      const next = new Set(prev)
      if (on) next.add(id); else next.delete(id)
      return next
    })
  }, [])

  const undo = useCallback(async entry => {
    const res = await journal.undo(entry.id)
    if (!res.ok) useUI.getState().toast(t('Couldn’t undo. Try again.'))
    setVersion(v => v + 1)
  }, [journal])

  const restore = useCallback(async entry => {
    if (inflight.current.has(entry.id)) return false
    inflight.current.add(entry.id)
    setBusyOf(entry.id, true)
    let res
    try { res = await journal.restore(entry.id) } catch { res = { ok: false, reason: 'error' } } finally {
      inflight.current.delete(entry.id)
      setBusyOf(entry.id, false)
    }
    const { toast } = useUI.getState()
    setVersion(v => v + 1)
    if (res.ok) {
      if (entry.kind === 'coach-move') {
        // The Coach chat says what revertLast did, so it stays truthful (CoachChat's own Undo).
        useStore.getState().update(s => appendChat(s, { role: 'coach', kind: 'reverted', text: t('Done! Your plan is back to how it was before my last changes.') }))
      }
      // The Coach has no undo of its undo, so its toast offers none.
      toast(restoredMessage(entry, res), isUndo(entry) ? undefined : { action: t('Undo'), onAction: () => undo(entry) })
      return true
    }
    if (isAlready(entry, res.reason)) {
      setAlready(prev => new Set(prev).add(entry.id))
      toast(t('Already back'))
      return true
    }
    toast(failureMessage(entry, res.reason))
    return false
  }, [journal, setBusyOf, undo])

  return { days, restoredIds, alreadyIds: already, busyIds: busy, unit: S?.unit === 'lb' ? 'lb' : 'kg', restore }
}
