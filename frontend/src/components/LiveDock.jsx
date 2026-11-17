import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { REST_MAX } from '../lib/duration.js'
import { isSwitching } from '../lib/use-tab-nav.js'
import { useDsAccent } from '../lib/use-ds-accent.js'
import Button from '../ds/Button.jsx'
import Dock from '../ds/Dock.jsx'
import Elapsed from './Elapsed.jsx'

const clock = sec => Math.floor(Math.max(0, sec) / 60) + ':' + String(Math.max(0, sec) % 60).padStart(2, '0')

// The one dock above the bar while a workout runs and you are somewhere else: the rest bar and
// the session's mini-bar in one, the design system's Dock. The dot, the routine and how long it
// has run; during a rest or a hold its countdown, and for a rest +30 and Skip. Anywhere on it but
// those two opens the workout. On the workout screen itself the full rest bar (RestTimer) is there
// instead.
//
// #timer stays the host: App.jsx puts it above the tab bar, search.css and the keyboard step it
// aside, and tab-shell.css places it. Its .g-root brings the design system's tokens and the
// person's accent; .g-dock-host (ds/ds.css) takes the old card off it so the Dock is the surface.
export default function LiveDock() {
  const nav = useNavigate()
  const active = useStore(s => s.S.active)
  const timer = useUI(s => s.timer)
  const work = useUI(s => s.work)
  const { addRest, stopRest } = useUI()
  const accent = useDsAccent()
  // The page keeps room at its bottom for the dock, as it does for the rest bar (index.css).
  useEffect(() => {
    document.body.classList.add('live-docked')
    return () => document.body.classList.remove('live-docked')
  }, [])
  const counting = work || timer
  const share = counting ? Math.max(0, Math.min(1, counting.left / counting.total)) : 0
  const open = () => { if (!isSwitching()) nav('/train/workout') }

  return (
    <div id="timer" className="dock g-root g-dock-host" data-accent={accent}>
      {/* The Dock's name is what it shows (the routine, how long, the countdown) after "Open workout". */}
      <Dock state="running" routine={active.name || t('Workout')} clock={<Elapsed start={active.start} />}
        count={counting ? (timer?.ready ? t('Ready') : clock(counting.left)) : undefined}
        progress={counting ? share : undefined} hold={!!work} openLabel={t('Open workout')} onOpen={open}>
        {timer ? (
          <>
            {!timer.ready && <Button size="sm" variant="secondary" icon="plus" disabled={timer.left >= REST_MAX} onClick={() => addRest(30)}
              aria-label={t('Add 30 seconds')}>30s</Button>}
            <Button size="sm" onClick={stopRest}>{timer.ready ? t('Dismiss') : t('Skip')}</Button>
          </>
        ) : null}
      </Dock>
      {/* Always there, so a screen reader hears "Ready" the moment it is written into it. */}
      <span className="g-sr" role="status">{timer?.ready ? t('Ready') : ''}</span>
    </div>
  )
}
