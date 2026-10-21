import { Suspense, useCallback, useRef, useState } from 'react'
import { t } from '../../lib/i18n.js'
import { back as tabBack } from '../../lib/use-tab-nav.js'
import { Page } from '../../components/layout.jsx'
import { PAGES } from '../settings-pages.js'
import { HostFrameContext } from './host-frame.js'
import { SETTINGS_ROOT } from './paths.js'
import { pageComponent } from './pages/index.js'
import { useFlashRow } from './use-flash-row.js'

/**
 * One Settings page (/me/<page>): the page's own component, which loads on first open. A page not
 * yet on the stage frame gets the old page header here; a page drawn in SettingsPage says so
 * (host-frame.js) and the header goes. `find` is a search hit's row, scrolled to and flashed once
 * the row is there. Every page goes back to Profile (§6).
 */
export default function SettingsPageHost({ page, find = null, via = null }) {
  const body = useRef(null)
  const [framed, setFramed] = useState(false)
  const onFramed = useCallback(() => setFramed(true), [])
  useFlashRow(body, find, via)
  const PageBody = pageComponent(page)
  return <div ref={body}>
    {!framed && <Page title={t(PAGES[page].title)} onBack={() => tabBack(SETTINGS_ROOT)} />}
    <HostFrameContext value={onFramed}>
      <Suspense fallback={null}><PageBody /></Suspense>
    </HostFrameContext>
  </div>
}
