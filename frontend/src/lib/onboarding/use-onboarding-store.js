import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { answersFromHub, loadOnboarding, saveStep } from './api.js'
import { nextAfter, pathOf, previousOf, screenOf, skipTarget } from './flow.js'
import { forget, initialState, loadSaved, reduce, save } from './state.js'
import { coachAvailable } from '../coach.js'
import { nutritionAvailable } from '../nutrition/api.js'

/**
 * The onboarding's state and actions, for OnboardingLayout to provide. `hub` says what the server
 * side can do: 'pre-auth' (no account yet), 'loading', 'ready', 'offline' (answers are kept and sent
 * again), 'unavailable' (no hub to save to: the flow steps aside) or 'complete'.
 */
export function useOnboardingStore({ user, config, navigate, location, navType }) {
  const [state, dispatch] = useReducer(reduce, undefined, () => loadSaved() || initialState())
  // The state as of the last action, for an action that saves right after it changes something.
  const now = useRef(state)
  const act = useCallback(action => {
    now.current = reduce(now.current, action)
    dispatch(action)
  }, [])
  useEffect(() => { save(state) }, [state])

  const [hub, setHub] = useState(user ? 'loading' : 'pre-auth')
  const uid = user?.id
  useEffect(() => {
    if (!uid) { setHub('pre-auth'); return undefined }
    if (!nutritionAvailable(user)) { setHub('unavailable'); return undefined }
    let live = true
    setHub('loading')
    loadOnboarding().then(res => {
      if (!live) return
      if (res.completedAt != null) { forget(); setHub('complete'); return }
      act({ type: 'hub', answers: answersFromHub(res.answers), coachAvailable: res.coachAvailable })
      setHub('ready')
    }).catch(e => {
      if (live) setHub(e.code === 'offline' || e.code === 'timeout' ? 'offline' : 'unavailable')
    })
    return () => { live = false }
    // Keyed on the person, not the object: a refreshed user is the same onboarding.
  }, [uid])

  /** Saves one hub step from the latest answers; a failure marks it to be sent again. */
  const saveHubStep = useCallback(async step => {
    try {
      await saveStep(step, now.current.answers)
      act({ type: 'saved', step, ok: true })
      return true
    } catch {
      act({ type: 'saved', step, ok: false })
      return false
    }
  }, [act])

  // The flow's own history, mirrored from the router's, so Back walks it where it can and a cold
  // entry (a reload, a link) goes to the step before instead of out of the app.
  const stack = useRef([])
  const screen = screenOf(location.pathname)
  // Once per history entry (location.key), whatever the screen.
  useEffect(() => {
    if (!screen) return
    const s = stack.current
    if (navType === 'POP') {
      const at = s.lastIndexOf(screen)
      stack.current = at >= 0 ? s.slice(0, at + 1) : [screen]
    } else if (navType === 'REPLACE' && s.length) {
      stack.current = [...s.slice(0, -1), screen]
    } else if (s[s.length - 1] !== screen) {
      stack.current = [...s, screen]
    }
  }, [location.key])

  const go = useCallback((to, { replace = false } = {}) => {
    navigate(pathOf(to, now.current.code), { replace })
  }, [navigate])

  const back = useCallback(() => {
    if (stack.current.length > 1) { navigate(-1); return }
    const prev = previousOf(screen, now.current)
    if (prev) navigate(pathOf(prev, now.current.code), { replace: true, state: { back: true } })
  }, [navigate, screen])

  /** On to the screen after `from`, by the skip map. */
  const next = useCallback(from => go(nextAfter(from, now.current)), [go])

  const skip = useCallback(from => {
    const to = skipTarget(from, now.current)
    if (from === 'training') {
      act({ type: 'skipTraining' })
      saveHubStep('training')
    } else if (from === 'plan') {
      act({ type: 'plan', plan: { kind: 'none' } })
      saveHubStep('plan')
    } else {
      // About you: what was answered stays, and is saved.
      if (Object.values(now.current.answers.body).some(v => v !== null)) saveHubStep('body')
      act({ type: 'skipYou' })
    }
    if (to) go(to)
  }, [act, go, saveHubStep])

  const coach = typeof state.coachAvailable === 'boolean' ? state.coachAvailable : coachAvailable(config, user)

  return useMemo(() => ({
    state, hub, screen, coachAvailable: coach,
    act, saveHubStep, go, back, next, skip,
    current: () => now.current,
  }), [state, hub, screen, coach, act, saveHubStep, go, back, next, skip])
}
