import { useEffect, useLayoutEffect, useRef } from 'react'
import { Navigate, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import InlineBanner from '../../ds/InlineBanner.jsx'
import OnboardingNav from '../../ds/OnboardingNav.jsx'
import StageScreen from '../../ds/StageScreen.jsx'
import { t, tn } from '../../lib/i18n.js'
import { OnboardingContext } from '../../lib/onboarding/contexts.js'
import { PRE_AUTH, STEP_COUNT, navOf, progressMax, stepOf, stepsLeft } from '../../lib/onboarding/flow.js'
import { useOnboardingStore } from '../../lib/onboarding/use-onboarding-store.js'
import { reducedMotion } from '../../lib/reduced-motion.js'
import { cx } from '../../lib/ui-kit.js'
import { useStore } from '../../store/useStore.js'
import ThreadLayer from './ThreadLayer.jsx'
import ThreadProvider from './ThreadProvider.jsx'

// The onboarding's layout, for every screen of the flow (motion-onboarding-thread.md §4, adapted
// from Next's route-group layout to this app's hash routes): the answers and the flow's navigation
// (OnboardingContext), the thread (ThreadProvider, ThreadLayer: nowhere else), the nav row, and
// the screen, all on the stage (StageScreen, Cobalt). It outlives every screen, so the line one
// rests on is where the next one's thread starts.
//
// The nav row is the kit's OnboardingNav: back, the eight steps (the furthest reached stays lit),
// Skip. What it shows on each screen is the flow's (flow.js navOf), never the screen's; where it
// is not shown the row is a 14px gap, as the boards draw the invite and the passkey result. "N
// steps left" is said, not shown: a polite live region beside it.
//
// Who may see what: before there is an account only the invite landing and the name step; without
// a hub to save to, or once complete, the flow steps aside to Home.
const EASE = 'cubic-bezier(.32,.72,0,1)'

export default function OnboardingLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const navType = useNavigationType()
  const user = useStore(s => s.user)
  const store = useOnboardingStore({ user, navigate, location, navType })
  const { screen, state, hub, act, refresh, back, skip } = store
  const navRef = useRef(null)
  const host = useRef(null)

  useEffect(() => {
    if (!screen) return
    const next = progressMax(state.progress, screen)
    if (next !== state.progress) act({ type: 'progress', progress: next })
  }, [screen, state.progress, act])

  // The screen comes in after its anchor has been measured at rest (a child's layout effect runs
  // before this one): in from 24px and a fade over 320ms, back the other way; reduced motion keeps
  // a 120ms fade. The thread carries the continuity, so the old screen simply goes.
  useLayoutEffect(() => {
    const el = host.current?.firstElementChild
    if (!el?.animate) return
    if (reducedMotion()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'linear' }); return }
    const back = navType === 'POP' || !!location.state?.back
    const rtl = getComputedStyle(el).direction === 'rtl'
    const dx = (back ? -24 : 24) * (rtl ? -1 : 1)
    el.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 320, delay: 60, easing: EASE, fill: 'backwards' })
  }, [location.key])

  let content = children
  if (screen && !user && !PRE_AUTH.includes(screen)) content = <Navigate to="/" replace />
  else if (screen && user && !PRE_AUTH.includes(screen) && (hub === 'unavailable' || hub === 'complete')) content = <Navigate to="/home" replace />
  const offline = (hub === 'offline' || hub === 'busy') && !!user && !PRE_AUTH.includes(screen)
  const meta = navOf(screen)
  const step = stepOf(screen)
  const left = meta.show ? stepsLeft(state.server?.remaining, screen) : null

  return (
    <OnboardingContext.Provider value={store}>
      <ThreadProvider navRef={navRef}>
        <StageScreen>
          <div className="ob">
            <nav ref={navRef} className={cx('ob-nav', !meta.show && 'gone')} aria-label={t('Onboarding')} aria-hidden={!meta.show || undefined}>
              {meta.show && <OnboardingNav step={step} filled={step ? state.progress : 0} total={STEP_COUNT}
                onBack={meta.back ? back : undefined} onSkip={meta.skip ? () => skip(screen) : undefined} />}
              {/* Always in the tree, so the count is announced when it changes, politely. */}
              <span className="sr-only" aria-live="polite">{left ? tn('{0} step left', '{0} steps left', left) : ''}</span>
            </nav>
            {offline && <div className="ob-hubnote">
              <InlineBanner stage title={hub === 'busy'
                ? t('Gains is busy right now. Try again in a moment. Nothing you answered is lost.')
                : t('Check your connection and try again. Nothing you answered is lost.')}
              actions={[{ label: t('Try again'), onClick: () => { refresh() } }]} />
            </div>}
            <ThreadLayer />
            <div className="ob-host" ref={host}>{content}</div>
          </div>
        </StageScreen>
      </ThreadProvider>
    </OnboardingContext.Provider>
  )
}
