import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cx } from '../lib/ui-kit.js'
import { tabOf } from '../lib/tab-route.js'
import { useScrolledBy } from '../lib/use-scrolled-by.js'
import AvatarButton from './AvatarButton.jsx'
import SearchPill from './SearchPill.jsx'

// The header of a tab's root (Home, Training, Nutrition, Progress), the bearmenu mobile header:
// one pinned row of the search pill, the tab's one context button where it has one (`action`),
// and the avatar. It carries no visible title, since the tab bar already names the tab; `title`
// is the page's name for a screen reader, its h1. The pill's placeholder is the tab's, read from
// the address rather than chosen by the page. A hairline fades in under it once the page scrolls.
// Until the search overlay exists the pill is a plain field: its text lives here.
export default function RootHeader({ title, action }) {
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')
  const scrolled = useScrolledBy(4)
  return (
    <div className={cx('tab-hdr', scrolled && 'scrolled')}>
      <h1 className="sr-only">{title}</h1>
      <div className="tab-hdr-row">
        <SearchPill scope={tabOf(pathname) || 'home'} value={query} onChange={setQuery} />
        {action}
        <AvatarButton />
      </div>
    </div>
  )
}
