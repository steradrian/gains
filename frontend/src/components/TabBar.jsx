import { useStore } from '../store/useStore.js'
import { workoutRunning } from '../lib/tab-route.js'
import { t } from '../lib/i18n.js'
import { hasUnsaved } from '../lib/unsaved-guard.js'
import { isSwitching, popToRoot, switchTab } from '../lib/use-tab-nav.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import GlassTabBar from '../ds/GlassTabBar.jsx'
import { confirmDrawer } from '../views/settings/confirm-drawer.js'

// The app's four tabs under the design system's names: Home is Today and Nutrition is Eat. The
// routes keep their own names (lib/tab-route.js).
const DS_TAB = { home: 'today', train: 'train', food: 'eat', me: 'me' }
const APP_TAB = Object.fromEntries(Object.entries(DS_TAB).map(([app, ds]) => [ds, app]))

// The bar on every page that has one (App.jsx), the design system's GlassTabBar in a .g-root of
// its own: the DS tokens and accent roles live only there, so it carries the person's accent
// mapped to a DS preset. #tabbar is what the shell holds inert and steps aside (Modals, search,
// the keyboard), and what places the bar on screen (tab-shell.css).
//
// `tab` is the tab on screen (lib/use-tab-nav.js) and `lit` whether the page is one of its own:
// a page every tab can open (the workout) sits on a tab but lights none.
export default function TabBar({ tab, lit, onPlus }) {
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // A boolean, not S: the bar re-renders when a workout starts or ends, not on every store write.
  const running = useStore(s => workoutRunning(s.S))
  const accent = useDsAccent()
  if (!user && !isGuest) return null
  // Any tab, the one on screen included: its root, scrolled to the top.
  const go = key => {
    if (isSwitching()) return
    const target = APP_TAB[key]
    const open = () => (target === tab ? popToRoot(target) : switchTab(target))
    // A page holding input that is only in its own state (lib/unsaved-guard.js) is not cleared
    // silently: the tap asks first, and Keep editing leaves everything as it was.
    if (hasUnsaved()) {
      confirmDrawer({
        title: t('Discard changes?'), body: t('Your changes are not saved.'),
        confirmLabel: t('Discard'), cancelLabel: t('Keep editing'), onConfirm: open,
      })
      return
    }
    open()
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
