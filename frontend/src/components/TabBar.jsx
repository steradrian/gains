import { useStore } from '../store/useStore.js'
import { workoutRunning } from '../lib/tab-route.js'
import { isSwitching, popToRoot, switchTab } from '../lib/use-tab-nav.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import GlassTabBar from '../ds/GlassTabBar.jsx'

// The app's four tabs under the design system's names: Home is Today, Nutrition is Eat and
// Progress is Me. The routes keep their own names (lib/tab-route.js).
const DS_TAB = { home: 'today', train: 'train', food: 'eat', progress: 'me' }
const APP_TAB = Object.fromEntries(Object.entries(DS_TAB).map(([app, ds]) => [ds, app]))

// The bar on every page that has one (App.jsx), the design system's GlassTabBar in a .g-root of
// its own: the DS tokens and accent roles live only there, so it carries the person's accent
// mapped to a DS preset. #tabbar is what the shell holds inert and steps aside (Modals, search,
// the keyboard), and what places the bar on screen (tab-shell.css).
//
// `tab` is the tab on screen (lib/use-tab-nav.js) and `lit` whether the page is one of its own:
// a page every tab can open (Profile, the workout) sits on a tab but lights none.
export default function TabBar({ tab, lit, onPlus }) {
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // A boolean, not S: the bar re-renders when a workout starts or ends, not on every store write.
  const running = useStore(s => workoutRunning(s.S))
  const accent = useDsAccent()
  if (!user && !isGuest) return null
  // The tab on screen again: back to its root. Another one: its own stack, where it was left.
  const go = key => {
    if (isSwitching()) return
    const target = APP_TAB[key]
    if (target === tab) popToRoot(target)
    else switchTab(target)
  }
  return (
    <div id="tabbar" className="g-root" data-accent={accent}>
      {/* The + opens the logging sheet on every tab. It is never a page of its own, so never lit,
          and it stays the accent while a workout runs: the dock and the Train dot say that. */}
      <GlassTabBar current={lit ? DS_TAB[tab] : null} running={running} onChange={go}
        onPlus={() => { if (!isSwitching()) onPlus() }} />
    </div>
  )
}
