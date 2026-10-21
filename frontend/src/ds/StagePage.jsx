import { useDsAccent } from '../lib/use-ds-accent.js'
import { back } from '../lib/use-tab-nav.js'
import StageNavBar from './StageNavBar.jsx'
import StageScreen from './StageScreen.jsx'

// The frame of a pushed page on the stage (boards Tr3Plan, Tr4Routines, Tr3PlanDay): the stage at
// half intensity (StageScreen `pushed`), the nav bar, an optional large title with its line, then
// the page's body. The floating tab bar is the app's (#tabbar, App.jsx), as on the roots, so the
// page only leaves room for it.
// `title` is the bar's centred title; a page with a `largeTitle` usually leaves it out, and the
// large title is then the page's heading (h1), otherwise h2. `onBack` replaces the default,
// which is one step down this tab's stack, or `parent` (a path) when the page was opened cold
// (a link, a reload) and has nothing under it (lib/use-tab-nav.js `back`). `backLabel` names
// Back for where it goes. `accent` is the design system's preset; the person's by default.
export default function StagePage({ title, onBack, backLabel, actions, largeTitle, sub, accent, parent, children }) {
  const own = useDsAccent()
  const Heading = title ? 'h2' : 'h1'
  return (
    <StageScreen pushed accent={accent || own}>
      <div className="g-spage">
        <StageNavBar title={title} onBack={onBack || (() => back(parent))} backLabel={backLabel} actions={actions} />
        {largeTitle && (
          <header className="g-spage-head">
            <Heading className="g-spage-title">{largeTitle}</Heading>
            {sub && <p className="g-spage-sub">{sub}</p>}
          </header>
        )}
        <div className="g-spage-body">{children}</div>
      </div>
    </StageScreen>
  )
}
