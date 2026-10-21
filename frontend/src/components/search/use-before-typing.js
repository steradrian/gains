import { useCallback, useEffect, useMemo } from 'react'
import { t } from '../../lib/i18n.js'
import { clearRecentsWithUndo, pruneRecents, removeRecent, useRecents } from '../../lib/search/recents.js'
import { beforeTypingOf } from '../../lib/search/start.js'
import { useUI } from '../../store/useUI.js'

const UNDO_MS = 8000

/**
 * What the search shows before anything is typed (lib/search/start.js `beforeTypingOf`: placeholder,
 * firstUse, shortcuts, recents, suggested), kept current with Recent, plus:
 *   remove(entry)  one Recent entry's ×
 *   clear()        Clear: Recent goes at once and the 8 s toast offers Undo (board Sh0Cleared);
 *                  returns the Undo too, for a caller with its own toast
 * A Recent entry whose target was deleted drops out once the list it lives in has loaded.
 */
export function useBeforeTyping(data, tab) {
  const list = useRecents(s => s.list)
  const searched = useRecents(s => s.searched)
  const view = useMemo(() => beforeTypingOf({ tab, data, list, searched }), [tab, data, list, searched])

  useEffect(() => {
    const gone = view.entries.filter(e => e.gone).map(e => e.r)
    if (gone.length) pruneRecents(r => !gone.includes(r))
  }, [view.entries])

  const clear = useCallback(() => {
    const undo = clearRecentsWithUndo()
    useUI.getState().toast(t('Recent searches cleared'), { action: t('Undo'), onAction: undo, ms: UNDO_MS })
    return undo
  }, [])

  return { ...view, remove: removeRecent, clear }
}
