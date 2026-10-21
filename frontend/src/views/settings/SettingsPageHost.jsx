import { Suspense, useRef } from 'react'
import { t } from '../../lib/i18n.js'
import { back as tabBack } from '../../lib/use-tab-nav.js'
import { Page } from '../../components/layout.jsx'
import { PAGES } from '../settings-pages.js'
import { SETTINGS_ROOT } from './paths.js'
import { OWN_FRAME, pageComponent } from './pages/index.js'
import { useFlashRow } from './use-flash-row.js'

/**
 * One Settings page (/me/<page>): the old page header over the page's own component, which loads
 * on first open. `find` is a search hit's row, scrolled to and flashed once the row is there.
 * Every page goes back to Profile (§6).
 */
export default function SettingsPageHost({ page, find = null, via = null }) {
  const body = useRef(null)
  useFlashRow(body, find, via)
  const PageBody = pageComponent(page)
  return <div ref={body}>
    {!OWN_FRAME.has(page) && <Page title={t(PAGES[page].title)} onBack={() => tabBack(SETTINGS_ROOT)} />}
    <Suspense fallback={null}><PageBody /></Suspense>
  </div>
}
