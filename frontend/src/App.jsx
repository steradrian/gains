import { useEffect, useLayoutEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { setWeightDecimals } from './lib/format.js'
import { accentValue, applyAccent } from './lib/accent.js'
import { setLang, useLang, baseLang } from './lib/i18n.js'
import { effectiveLang } from './lib/default-lang.js'
import { setPlayOnSilent, setVibrate, setAlarmBuzzer } from './lib/sound.js'
import { buzzAsAlarm } from './lib/rest-alert.js'
import { setNav } from './lib/nav.js'
import { setSystemBarsLight } from './lib/system-bars.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { isModeRoot, launchPath, legacyPath, workoutRunning } from './lib/mode-route.js'
import { lastMode, useModeNav } from './lib/use-mode-nav.js'
import { scrollAction } from './lib/scroll-restore.js'
import { installViewportGuard } from './lib/viewport-guard.js'
import { installChipDrag } from './lib/hchips.js'
import { syncPushSubscription } from './lib/push.js'
import { MOBILE } from './lib/mobile.js'
import { BRAND } from './brand.js'
import { exitWorkoutEdit, startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import TabBar from './components/TabBar.jsx'
import ModeHeader from './components/ModeHeader.jsx'
import { openPlusSheet } from './components/PlusSheet.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import SyncBanner from './components/SyncBanner.jsx'
import RestTimer from './components/RestTimer.jsx'
import TimerFlash from './components/TimerFlash.jsx'
import { openDeviceLinkRedeem } from './components/Passkeys.jsx'
import Login from './views/Login.jsx'
import MobileOnboarding from './views/MobileOnboarding.jsx'
import Home from './views/Home.jsx'
import CheckIn from './views/CheckIn.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Muscles from './views/Muscles.jsx'
import StructuralBalance from './views/StructuralBalance.jsx'
import ProgressPhotos from './views/ProgressPhotos.jsx'
import { SettingsRoute } from './views/Settings.jsx'
import Admin from './views/Admin.jsx'
import CoachChat from './views/CoachChat.jsx'
import Measurements from './views/Measurements.jsx'
import CoachIntake from './views/CoachIntake.jsx'
import CoachSetup from './views/CoachSetup.jsx'
import ComingSoon from './views/ComingSoon.jsx'
import './mode-shell.css'

// last known scrollY per mode and route, so back-navigation can put the page where it was
const scrollPositions = new Map()

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

// theme === 'system' follows the OS/browser preference instead of a fixed choice.
const resolveTheme = theme => theme === 'light' || theme === 'dark'
  ? theme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = resolveTheme(theme)
  applyAccent(de, accent, de.dataset.theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = BRAND.themeColor[de.dataset.theme] || BRAND.themeColor.dark
  if (MOBILE) setSystemBarsLight(de.dataset.theme === 'light')
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const navType = useNavigationType()
  const { S, user, ready } = useStore()
  // iOS: whether timer sounds get past the ring/silent switch (Settings → Sounds). Page-level,
  // so it is applied here on load and on change rather than at each beep.
  useEffect(() => { setPlayOnSilent(!!S.soundOnSilent) }, [S.soundOnSilent])
  // Settings → Vibrate, the same way: one page-level switch rather than a check at each buzz.
  useEffect(() => { setVibrate(S.vibrate !== false) }, [S.vibrate])
  // Android app: "Vibrate when the phone is on silent" sends the end-of-rest buzz through the
  // native side as an alarm (#375). buzzAsAlarm answers false off Android, so iOS buzzes as before.
  useEffect(() => { setAlarmBuzzer(MOBILE && S.vibrate !== false && S.vibrateOnSilent ? buzzAsAlarm : null) }, [S.vibrate, S.vibrateOnSilent])
  const isGuest = useStore(s => s.isGuest())
  const needsMobileOnboarding = useStore(s => s.needsMobileOnboarding)
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  // The mode (Training / Nutrition) comes from the route; `shown` is the location on screen,
  // which a mode switch holds still while it rebuilds the history underneath (lib/use-mode-nav.js).
  const { mode, shown, switching, switchMode } = useModeNav({ navigate, location: loc, navType })
  const lastEditPath = useRef(loc.pathname)
  // Any in-app route exit, browser back included, returns to the persisted draft and asks for a
  // save decision. Reload needs no prompt because the draft itself is already in local storage.
  useEffect(() => {
    const previous = lastEditPath.current
    lastEditPath.current = loc.pathname
    // The live store, not this render's S: a save that just closed the editor may not have
    // reached this render yet, and asking again would offer to delete the workout it saved.
    if (previous !== '/train/workout' || !useStore.getState().S.active?.editingWorkoutId || loc.pathname === '/train/workout') return
    const destination = loc.pathname + loc.search
    navigate('/train/workout', { replace: true })
    exitWorkoutEdit(() => navigate(destination, { replace: true }))
  }, [loc.pathname, loc.search, S.active?.editingWorkoutId, navigate])
  // A preset key, or the user's own colour as '#rrggbb' (lib/accent.js), already checked.
  const accent = accentValue(S)
  useEffect(() => { applyPrefs(S.theme, accent) }, [S.theme, accent])
  // 'system' needs to react live if the OS theme flips while the app is open, not just on
  // the next mount — a fixed 'dark'/'light' choice never re-fires this since matchMedia
  // isn't consulted for those.
  useEffect(() => {
    if (S.theme !== 'system' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyPrefs(S.theme, accent)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [S.theme, accent])
  // A profile that never picked a language follows the instance default or the browser (#303) —
  // worked out here, on this device, and never written into the synced state (lib/default-lang.js).
  const config = useStore(s => s.config)
  const lang = effectiveLang(S, config)
  useEffect(() => { setLang(lang, S.enParens?.[baseLang(lang)] ?? true, S.enOnly?.[baseLang(lang)] === true) }, [lang, S.enParens, S.enOnly])
  // Same shape as the language: a module-level display setting, pushed when it changes (#139).
  useEffect(() => { setWeightDecimals(S.wdec) }, [S.wdec])
  useEffect(() => { document.documentElement.lang = lang }, [langV, lang])
  // Forward navigation starts at the top; going back lands where you left off.
  // The position is recorded from scroll events rather than read at route
  // change, because by then a shorter page may already have clamped it.
  const pathRef = useRef(null)
  // iOS leaves the page displaced after the keyboard goes away (see lib/viewport-guard.js).
  useEffect(() => installViewportGuard(), [])
  // Click-drag a horizontal chip strip to scroll it sideways (lib/hchips.js) — on a desktop
  // browser there's otherwise no way to reach the filters past the edge.
  useEffect(() => installChipDrag(), [])
  // Once per signed-in boot, hand the server this browser's push subscription again (see
  // lib/push.js): a subscription the instance lost is back before the next reminder is due,
  // with nobody having to visit Settings. Web only — the APK has no service worker.
  useEffect(() => {
    if (MOBILE || !user || !ready) return
    syncPushSubscription().catch(() => {})
  }, [user?.id, ready])
  // Opened from a device-link QR code (#95): once boot knows who is here, the sheet that redeems
  // it opens by itself — over the sign-in screen, or over the app for a guest or a signed-in
  // browser. Once per visit; closed, the code stays for the sign-in screen's own button.
  const linkCode = useStore(s => s.linkCode)
  const linkOffered = useRef(false)
  useEffect(() => {
    if (!ready || !linkCode || linkOffered.current) return
    linkOffered.current = true
    openDeviceLinkRedeem()
  }, [ready, linkCode])
  // While a mode switch rebuilds the history the page on screen does not change, and a scroll
  // event then (the browser clamping) is not a position anyone chose.
  const switchingRef = useRef(false)
  switchingRef.current = switching
  useEffect(() => {
    const onScroll = () => {
      // Modals pins the body while a sheet is open; scrollY is 0 then, not a position.
      if (document.body.style.position === 'fixed' || switchingRef.current) return
      scrollPositions.set(pathRef.current, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Arriving by a switch, not walking back later onto an entry a switch wrote.
  const modeSwitch = !!shown.state?.modeSwitch && navType !== 'POP'
  // A shared page (/me) keeps a scroll position per mode it is opened from.
  const scrollKey = mode + ' ' + shown.pathname
  useLayoutEffect(() => {
    if (switching) return
    const first = pathRef.current === null
    const samePath = pathRef.current === scrollKey
    pathRef.current = scrollKey
    const action = scrollAction({ first, samePath, navType, modeSwitch })
    // A fresh load arrives as a POP with nothing remembered. It goes to the top like any new
    // route — now, not a frame later: that frame landed on top of a scroll a view made on mount
    // (the superset card centring its row, views/Workout.jsx), and a smooth scroll cut off by a
    // scrollTo is simply gone.
    if (action === 'top') { window.scrollTo(0, 0); return }
    // A POP that stays on the route we are on is not a back-navigation: it is the history
    // entry a sheet pushed (Modals.jsx, #63) being unwound as the sheet closes. Nothing new
    // mounted, Modals puts the page back where it was itself, and a view that scrolled on
    // purpose because the sheet closed — the workout list going to the current exercise after
    // ⋯ → Layout → List (#224) — must not be dragged back to a position recorded before that
    // scroll's event had even been dispatched.
    if (action === 'keep') return
    const y = scrollPositions.get(scrollKey) || 0
    // Into the other mode: the page goes back where it was left before it is first painted.
    if (modeSwitch) window.scrollTo(0, y)
    // the restored view needs a layout pass before it is tall enough to scroll to y
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, y))
    return () => window.cancelAnimationFrame(frame)
  }, [scrollKey, navType, switching])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && !S.active.editingWorkoutId && S.keepAwake !== false)
  // A running workout has the whole screen (v1.3.11): no tab bar, and the rest bar docks to the
  // bottom edge in its place. Its header's ⌄ goes back to the app, where the tab bar's Resume
  // brings it back.
  const inWorkout = shown.pathname === '/train/workout' && !!S.active
  useEffect(() => {
    document.body.classList.toggle('no-tabbar', inWorkout)
    return () => document.body.classList.remove('no-tabbar')
  }, [inWorkout])
  // The chat owns the bottom of the screen as well: its composer sits where the tabs would be.
  // The first-launch card has no tabs either: they changed the route behind it.
  const noTabs = inWorkout || shown.pathname === '/train/coach' || needsMobileOnboarding
  // No route of its own (a launch, a home-screen icon): the running workout, else the mode used
  // last. A route from before the modes: where it lives now, query and all.
  const legacy = legacyPath(shown.pathname)
  const fallback = legacy ? legacy + shown.search : launchPath({ lastMode: lastMode(), workoutRunning: workoutRunning(S) })

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      <div id="app">
        {/* Outside the keyed view, so it stays put while the page under it changes. */}
        {authed && !needsMobileOnboarding && isModeRoot(shown.pathname) && <ModeHeader mode={mode} onSwitch={switchMode} />}
        {/* keyed on the route: a view that throws is contained, and switching tabs
            re-mounts the boundary, so the tab bar is always a way out */}
        <div className={'route-view' + (modeSwitch ? ' mode-in' : '')} key={shown.pathname}>
          <ErrorBoundary>
            {!authed ? <Login /> : needsMobileOnboarding ? <MobileOnboarding /> : (
              <Routes location={shown}>
                <Route path="/" element={<Navigate to={fallback} replace />} />
                <Route path="/train" element={<Navigate to="/train/home" replace />} />
                <Route path="/train/home" element={<Home />} />
                {/* Gym check-in — switched off in Settings, the route falls through to the
                    catch-all redirect below. */}
                {S.checkIn !== false && <Route path="/train/checkin" element={<CheckIn />} />}
                <Route path="/train/plan" element={<Plan />} />
                <Route path="/train/plan/r/:id" element={<RoutineEdit />} />
                <Route path="/train/workout" element={<Workout />} />
                <Route path="/train/stats" element={<Stats />} />
                <Route path="/train/history" element={<History />} />
                <Route path="/train/library" element={<Library />} />
                <Route path="/train/muscles" element={<Muscles />} />
                <Route path="/train/structural-balance" element={<StructuralBalance />} />
                {/* The Coach screens gate themselves on the instance config; the routes exist
                    unconditionally so a deep link from a notification lands somewhere sane
                    rather than on the catch-all. */}
                <Route path="/train/coach" element={<CoachChat />} />
                <Route path="/train/coach/intake" element={<CoachIntake />} />
                <Route path="/train/coach/proposal" element={<Navigate to="/train/coach" replace />} />
                <Route path="/train/coach/setup" element={<CoachSetup />} />
                <Route path="/food" element={<Navigate to="/food/diary" replace />} />
                <Route path="/food/diary" element={<ComingSoon screen="diary" />} />
                <Route path="/food/foods" element={<ComingSoon screen="foods" />} />
                <Route path="/food/stats" element={<ComingSoon screen="stats" />} />
                <Route path="/food/goals" element={<ComingSoon screen="goals" />} />
                {/* Shared by both modes: they sit on top of whichever one opened them. */}
                <Route path="/body" element={<Navigate to="/body/measurements" replace />} />
                <Route path="/body/measurements" element={<Measurements />} />
                <Route path="/body/photos" element={<ProgressPhotos />} />
                <Route path="/wellness" element={<ComingSoon screen="wellness" />} />
                <Route path="/me" element={<SettingsRoute />} />
                <Route path="/me/admin" element={user?.admin ? <Admin /> : <Navigate to="/train/home" replace />} />
                <Route path="/me/:page" element={<SettingsRoute />} />
                <Route path="*" element={<Navigate to={fallback} replace />} />
              </Routes>
            )}
          </ErrorBoundary>
        </div>
      </div>
      {/* Outside #app: the view's fade-in animates a transform, and a fixed element inside it
          would ride along with the page for the length of it. Decides for itself when to show —
          including on the sign-in screen, when the server has just ended the session. */}
      <SyncBanner />
      {!noTabs && <TabBar mode={mode} pathname={shown.pathname} onStart={startFlow} onPlus={openPlusSheet} />}
      <RestTimer />
      <Modals />
      <Toast />
      <TimerFlash />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
