import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { slotOf, tabIndex, TABS, workoutRunning } from '../lib/mode-route.js'
import Icon from './Icon.jsx'
import Elapsed from './Elapsed.jsx'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="tab-ic"><Icon name={icon} /></span><span>{label}</span>
    </button>
  )
}

// Glyphs from the existing set until the nutrition ones land in Icon.jsx.
const TAB_LOOK = {
  train: [['house', () => t('Home')], ['calendar', () => t('Plan')], ['chart', () => t('Stats')], ['dumbbell', () => t('Exercises')]],
  food: [['note', () => t('Diary')], ['list', () => t('Foods')], ['chart', () => t('Stats')], ['target', () => t('Goals')]],
}

// The pill animates only once its first paint is two frames behind it, so it never slides in on
// a launch, a deep link or a mode switch — each of those mounts it where it belongs.
export function useSlideReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setReady(true)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return ready
}

// The selected tab's pill: one slot wide, slid by transform only between the four tabs and never
// onto the disc's slot. Keyed on the mode, so a switch mounts a new one instead of sliding across.
function TabPill({ active }) {
  const ready = useSlideReady()
  return (
    <span className={'tab-pill-track' + (ready ? ' ready' : '')} aria-hidden="true">
      <span className={'tab-pill-slot' + (active < 0 ? ' off' : '')} style={{ '--slot': slotOf(Math.max(0, active)) }}>
        <span className="tab-pill" />
      </span>
    </span>
  )
}

// `pathname` is the page on screen, which during a mode switch is not yet the router's.
export default function TabBar({ mode = 'train', pathname, onStart, onPlus }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const onWorkout = pathname === '/train/workout'
  // The workout's own screen lights the disc, not a tab: the pill fades out there.
  const active = tabIndex(mode, pathname)

  const running = !onWorkout && workoutRunning(S)
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/train/workout')
  }

  // Keyed on the route, so a mode switch mounts the other mode's tabs (fading in) while the disc,
  // keyed on its slot, stays put and only swaps its glyph.
  const tabs = TABS[mode].map((tab, i) => {
    const [icon, label] = TAB_LOOK[mode][i]
    return <Tab key={tab.path} active={active === i} icon={icon} label={label()} onClick={() => nav(tab.path)} />
  })

  return (
    <nav id="tabbar" className={'tabbar-' + mode}>
      <TabPill key={mode} active={active} />
      {tabs.slice(0, 2)}
      {/* Training: on the workout screen itself there is nothing to resume, so the button reads
          as the tab it is and stays lit (#29); anywhere else it brings you back to the exercise
          you were on — the marker is kept in S.active.cur and never moves on its own (#21). The
          glyph is always play: start and resume are one concept, and an exercise is a dumbbell.
          A live session you stepped away from shows its running time instead of a word, the
          button still named Resume; a past workout being edited or logged after the fact has no
          clock to run.
          Nutrition: + opens the logging sheet. It is never a route, so it is never lit, and it
          stays the accent while a workout runs: the dot on the Training segment says that. */}
      {mode === 'food'
        ? <button key="disc" className="start" onClick={onPlus} aria-haspopup="dialog">
            <span className="cir"><Icon key="plus" name="plus" className="cir-glyph" /></span>
            <span>{t('Add')}</span>
          </button>
        : <button key="disc" className={'start' + (S.active ? ' rec' : '') + (S.active && onWorkout ? ' on' : '')} onClick={startWorkout}
            aria-label={running ? t('Resume') : undefined}>
            <span className="cir"><Icon key="play" name="play" className="cir-glyph" /></span>
            {running ? <span className="tab-time"><Elapsed start={S.active.start} /></span>
              : <span>{S.active ? (onWorkout ? t('Workout') : S.active.editingWorkoutId ? t('Edit workout') : t('Resume')) : t('Start')}</span>}
          </button>}
      {tabs.slice(2)}
    </nav>
  )
}
