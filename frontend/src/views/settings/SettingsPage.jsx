import { useContext, useLayoutEffect } from 'react'
import StagePage from '../../ds/StagePage.jsx'
import StagePageTitle from '../../ds/StagePageTitle.jsx'
import { HostFrameContext } from './host-frame.js'
import { SETTINGS_ROOT } from './paths.js'

/**
 * The frame of a Settings page on the stage (boards St1*, St2*, St3*): the nav bar with Back, the
 * large title as the page's one h1 with an optional `line` under it, then the page's body. Back is
 * one step down this tab's stack, or `parent` (a path) when the page was opened cold, as with a
 * link or a reload (lib/use-tab-nav.js `back`). `actions` are the nav bar's icon buttons,
 * `[{ icon, label, onClick }]`. The page is transparent: the stage behind it is the app's.
 */
export default function SettingsPage({ title, line, parent = SETTINGS_ROOT, actions, children }) {
  const framed = useContext(HostFrameContext)
  useLayoutEffect(() => { framed?.() }, [framed])
  return (
    <StagePage parent={parent} actions={actions}>
      <StagePageTitle title={title} line={line} />
      {children}
    </StagePage>
  )
}
