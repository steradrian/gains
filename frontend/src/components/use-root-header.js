import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { notificationsPath } from '../lib/tab-route.js'
import { useUnreadCount } from '../lib/notifications/use-notifications.js'
import { useHubStatusRefresh, useHubTrouble } from '../lib/nutrition/sync.js'
import { groupTitle, placeholderFor, searchTab } from '../lib/search/scopes.js'
import {
  SEARCH_LIST_ID, closeSearch, openSearch, overlayKey, registerPill, releasePill, setGroup, setQuery, takeFocusOnMount, useSearch,
} from '../lib/search/session.js'
import { useStore } from '../store/useStore.js'
import { SETTINGS_ROOT } from '../views/settings/paths.js'
import { useConnectionTrouble } from './SyncBanner.jsx'

/**
 * What a tab root's header (ds/StageHeader, `pinned`) is given, for Today, Train, Eat and Me alike:
 *   initial, alert   the avatar's letter, and its dot with why (a stuck sync, the hub's sync)
 *   onSettings       the avatar: opens Settings (/me/settings), from any tab
 *   onBell, unread   Notifications under this tab (/:tab/notifications), and how many are unread
 *   placeholder      the tab's ("Search training"); `tab` is the tab the header is on
 * and the global search's field, the bearmenu header (lib/search/session.js holds the query): the
 * pill is the search's one input and stays where it is. Focusing it opens the overlay, typing sets
 * the query, the bell turns into × which closes it, and a scope sits in the field as a chip. The
 * input is the combobox whose listbox is the overlay's results: the arrows, Enter, Home and End
 * go to the overlay (`overlayKey`); Escape empties the field, then closes. ⌘K focuses it
 * (registerPill, takeFocusOnMount).
 */
export function useRootHeader(tab) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const user = useStore(s => s.user)
  const connection = useConnectionTrouble()
  const hub = useHubTrouble()
  useHubStatusRefresh()
  const unread = useUnreadCount()
  const open = useSearch(s => s.open)
  const query = useSearch(s => s.query)
  const group = useSearch(s => s.group)
  const active = useSearch(s => s.active)
  const scope = searchTab(tab)
  const input = useRef(null)

  useEffect(() => {
    const pill = input.current
    registerPill(pill)
    if (takeFocusOnMount()) pill?.focus()
    return () => releasePill(pill)
  }, [])

  // Closing hands the focus to the bell, which the × turns back into in the same place: the field
  // lets go (the keyboard goes down) and the focus is not dropped onto the page.
  const close = () => {
    closeSearch()
    const bell = input.current?.closest('.g-shdr')?.querySelector('.g-bell')
    if (bell) bell.focus()
    else input.current?.blur()
  }
  const onKeyDown = e => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (useSearch.getState().query) setQuery('')
      else close()
      return
    }
    overlayKey(e)
  }

  return {
    initial: (user?.name || '').trim(),
    alert: connection ? t('Connection problem') : hub ? t('Nutrition sync needs attention') : null,
    // The avatar opens Settings from every tab, Me included (Settings is a page pushed from Profile).
    onSettings: () => nav(SETTINGS_ROOT),
    // The inbox opens under the tab the bell is on (/:tab/notifications); the count is the bell's.
    onBell: () => nav(notificationsPath(pathname)),
    unread,
    placeholder: placeholderFor(scope),
    searching: open,
    onSearch: v => (v ? openSearch(scope) : close()),
    query,
    onQuery: setQuery,
    scope: open && group ? groupTitle(group) : null,
    onClearScope: () => { setGroup(null); input.current?.focus() },
    inputRef: input,
    inputProps: {
      role: 'combobox', 'aria-haspopup': 'listbox', 'aria-expanded': open, 'aria-autocomplete': 'list',
      'aria-controls': open ? SEARCH_LIST_ID : undefined,
      'aria-activedescendant': open && active ? active : undefined,
      onKeyDown,
    },
  }
}
