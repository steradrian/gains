// A tab tap clears the tab's sub-pages (lib/use-tab-nav.js), so a page holding input that only
// lives in its own state, with no autosave to the store, says so while it is dirty and the bar asks
// before it goes (components/TabBar.jsx). Pages that write as you type (the routine and food
// editors) or edit in a drawer do not register.
import { useEffect } from 'react'

const dirtyPages = new Set()

export const hasUnsaved = () => dirtyPages.size > 0

/** Registers the page as holding unsaved input for as long as `dirty` is true. */
export function useUnsavedGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined
    const token = {}
    dirtyPages.add(token)
    return () => { dirtyPages.delete(token) }
  }, [dirty])
}
