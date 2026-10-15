import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { cx } from '../lib/ui-kit.js'
import { tabOf } from '../lib/tab-route.js'
import { useScrolledBy } from '../lib/use-scrolled-by.js'
import { useStore } from '../store/useStore.js'
import { nutritionAvailable } from '../lib/nutrition/api.js'
import { SEARCH_OVERLAY_ID, closeSearch, openSearch, overlayKey, registerPill, setQuery, takeFocusOnMount, useSearch } from '../lib/search/session.js'
import AvatarButton from './AvatarButton.jsx'
import SearchPill from './SearchPill.jsx'
import { scanSheet } from './ScanSheet.jsx'

// What the pill says while the search is scoped to one group (ui-search.md §5).
const SCOPED = {
  pages: () => t('Search pages'), settings: () => t('Search settings'), exercises: () => t('Search exercises'),
  routines: () => t('Search routines'), workouts: () => t('Search workouts'), foods: () => t('Search your foods'), days: () => t('Search days'),
}

const desktopKeys = () => { try { return !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches } catch { return false } }

// The header of a tab's root (Home, Training, Nutrition, Progress), the bearmenu mobile header:
// one pinned row of the search pill, the tab's one context button where it has one (`action`),
// and the avatar. It carries no visible title, since the tab bar already names the tab; `title`
// is the page's name for a screen reader, its h1. The pill's placeholder is the tab's, read from
// the address rather than chosen by the page. A hairline fades in under it once the page scrolls.
// The pill is the global search's input (lib/search/session.js): focusing it opens the overlay,
// the avatar becomes its close button and the context button steps aside while it is open.
export default function RootHeader({ title, action }) {
  const { pathname } = useLocation()
  const scrolled = useScrolledBy(4)
  const tab = tabOf(pathname) || 'home'
  const open = useSearch(s => s.open)
  const query = useSearch(s => s.query)
  const group = useSearch(s => s.group)
  const active = useSearch(s => s.active)
  const nutrition = nutritionAvailable(useStore(s => s.user))
  const input = useRef(null)
  useEffect(() => {
    registerPill(input.current)
    if (takeFocusOnMount()) input.current?.focus()
    return () => registerPill(null)
  }, [])
  const close = () => { closeSearch(); input.current?.blur() }
  return (
    <div className={cx('tab-hdr', (scrolled || open) && 'scrolled')}>
      <h1 className="sr-only">{title}</h1>
      <div className="tab-hdr-row">
        <SearchPill scope={tab} value={query} onChange={setQuery} onOpen={() => openSearch(tab)} expanded={open}
          controls={SEARCH_OVERLAY_ID} activeDescendant={active} inputRef={input} shortcut={desktopKeys()}
          placeholder={open && group ? SCOPED[group]?.() : undefined}
          onEscape={close} onKeys={overlayKey} onScan={nutrition ? () => scanSheet({}) : undefined} />
        {!open && action}
        <AvatarButton mode={open ? 'close' : 'profile'} onClose={close} />
      </div>
    </div>
  )
}
