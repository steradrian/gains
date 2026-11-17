import { useLocation } from 'react-router-dom'
import StageHeader from '../ds/StageHeader.jsx'
import { tabOf } from '../lib/tab-route.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import { useFoodOn } from '../lib/nutrition/food-on.js'
import { scanToSelection } from './scan-to-selection.js'
import { useRootHeader } from './use-root-header.js'

// The header of a tab root that is not on the stage yet (Train, Eat, Progress): the same header as
// Today's (ds/StageHeader, the avatar, the search pill and the bell), on the stage's ground, fixed
// to the top of the window with the status bar inside it (owner direction, PR-07: the bearmenu
// header). Nothing in it moves while searching; the bell turns into the search's ×. `title` is
// the page's name for a screen reader, its h1, since the tab bar already names the tab. `action`
// is the tab's one context readout (Nutrition's "N left"). The spacer keeps the page's first
// block clear of the fixed header.
export default function RootHeader({ title, action }) {
  const { pathname } = useLocation()
  const accent = useDsAccent()
  const nutrition = useFoodOn()
  const header = useRootHeader(tabOf(pathname))
  return <>
    <div className="g-root root-hdr" data-accent={accent}>
      <StageHeader pinned title={title} {...header} action={action} onScan={nutrition ? scanToSelection : undefined} />
    </div>
    <div className="root-hdr-space" aria-hidden="true" />
  </>
}
