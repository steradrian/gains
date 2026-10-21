import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { tabOf } from '../lib/tab-route.js'
import { popToRoot } from '../lib/use-tab-nav.js'
import { useHubStatusRefresh, useHubTrouble } from '../lib/nutrition/sync.js'
import { groupTitle, placeholderFor, searchTab } from '../lib/search/scopes.js'
import {
  SEARCH_LIST_ID, closeSearch, openSearch, overlayKey, registerPill, setGroup, setQuery, takeFocusOnMount, useSearch,
} from '../lib/search/session.js'
import { useStore } from '../store/useStore.js'
import { useConnectionTrouble } from './SyncBanner.jsx'

/**
 * What a tab root's header (ds/StageHeader, `pinned`) is given, for Today, Train, Eat and Me alike:
 *   initial, alert   the avatar's letter, and its dot with why (a stuck sync, the hub's sync)
 *   onSettings       Profile: from another tab it switches to Me; on Me's stack it goes back down
 *   onBell           Notifications
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
  const open = useSearch(s => s.open)
  const query = useSearch(s => s.query)
  const group = useSearch(s => s.group)
  const active = useSearch(s => s.active)
  const scope = searchTab(tab)
  const input = useRef(null)

  useEffect(() => {
    registerPill(input.current)
    if (takeFocusOnMount()) input.current?.focus()
    return () => registerPill(null)
  }, [])

  const close = () => { closeSearch(); input.current?.blur() }
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
    // Profile is the Me tab's root: from Progress, on Me's stack, back down to it rather than a
    // second Profile on top.
    onSettings: () => { if (tabOf(pathname) === 'me') popToRoot('me'); else nav('/me') },
    onBell: () => nav('/me/notifications'),
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
