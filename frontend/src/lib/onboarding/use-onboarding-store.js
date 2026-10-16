import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { answersFromHub, loadOnboarding, saveStep, waitSeconds } from './api.js'
import { nextAfter, pathOf, previousOf, screenOf, skipTarget } from './flow.js'
import { forget } from './session.js'
import { initialState, loadSaved, reduce, save } from './state.js'
import { nutritionAvailable } from '../nutrition/api.js'
import { useStore } from '../../store/useStore.js'

// The only answers that say there is no onboarding to be had here: not signed in to the hub, not
// allowed, no hub at this address, gone. Anything else that fails to read says nothing about
// whether there is a hub: no answer, a server error, an answer that is not the hub's JSON, a
// rate limit (429), a refused request. The person stays in the flow with what they answered, and
// can try again.
const NOT_THEIRS = [401, 403, 404, 410]
const hubDown = e => !NOT_THEIRS.includes(e.status)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
// Up to this much is added to a wait on the hub's Retry-After, at random per waiter: a save, a
// preview and a read held back by the same 429 would otherwise all go out in the same millisecond
// and be limited together again. Half a second spreads them, and is small beside the seconds a
// Retry-After asks for.
const WAKE_JITTER_MS = 500

/**
 * The onboarding's state and actions, for OnboardingLayout to provide. `hub` says what the server
 * side can do: 'pre-auth' (no account yet), 'loading', 'ready', 'offline' (the hub did not answer,
 * or not as itself: answers are kept and sent again, and the layout offers to read it again),
 * 'busy' (it answered 429: the same, and nothing is sent before its Retry-After has passed),
 * 'unavailable' (no hub to save to: the flow steps aside) or 'complete'.
 *
 * The hub's answer at each load fills in what this tab does not know: its answers, what the
 * person's data answers (those steps are skipped, flow.js answeredByData), where to resume, and
 * which plans this server takes. A plan is offered only where the hub says so: never from this
 * app's own config, which cannot say whether openGym's seed takes it.
 *
 * The state is the signed-in person's (state.js `uid`): another person's is never read, and it
 * goes whenever the flow is left (`discard`) or who is signed in changes.
 */
export function useOnboardingStore({ user, navigate, location, navType }) {
  const uid = user?.id ?? null
  const [state, dispatch] = useReducer(reduce, undefined, () => loadSaved(uid) || { ...initialState(), uid })
  // The state as of the last action, for an action that saves right after it changes something.
  const now = useRef(state)
  const act = useCallback(action => {
    now.current = reduce(now.current, action)
    dispatch(action)
  }, [])
  // Kept only while it is the signed-in person's: for the render between a sign-out and the state
  // starting over, the old person's is not written down again.
  useEffect(() => { if (state.uid === uid) save(state) }, [state, uid])

  // A save still waiting its turn when the person changes belongs to the one before.
  const people = useRef(0)
  const signedInAs = useRef(uid)
  useEffect(() => {
    if (signedInAs.current !== uid) { signedInAs.current = uid; people.current++ }
    act({ type: 'user', uid })
  }, [uid, act])

  /** Leaves the flow: nothing of it stays, in this tab's storage or on screen. */
  const discard = useCallback(() => {
    forget()
    act({ type: 'reset' })
  }, [act])

  /**
   * The hub refused a request as made for another account while this tab still holds the same
   * person it wrote for: whoever is signed in is not who this tab thinks (the session changed in
   * another tab, and this one has not heard). Nothing in the store can read who that is without
   * running the app's boot again, so the page starts over: the answers on screen are dropped, the
   * cached user goes too (a boot that cannot reach /api/me would otherwise take it for the
   * signed-in one and be refused the same way), nothing of this tab's copy can be pushed under
   * the new session (the app's store holds for the restart, and leaves the user and the screens
   * as they are), and the reload reads the signed-in person and re-keys everything to them. Once
   * started it is not started again, and nothing more is sent: `restarting()` says so.
   */
  const restarting = useRef(false)
  const signedInElsewhere = useCallback(() => {
    if (restarting.current) return
    restarting.current = true
    useStore.getState().holdForRestart()
    discard()
    window.location.reload()
  }, [discard])

  const [hub, setHub] = useState(user ? 'loading' : 'pre-auth')
  // For hubCall, which comes before the read it asks for again.
  const hubNow = useRef(hub)
  hubNow.current = hub
  const reading = useRef(0)
  const refreshNow = useRef(null)
  // The latest read: an answer to an earlier one (another person's, or the layout gone) is dropped.
  const reads = useRef(0)

  // When the hub said it is busy, the time before which nothing more is sent to it, and whether
  // its last answer was a 429 at all (a Retry-After of 0 is a 429 with no wait left).
  const busyUntil = useRef(0)
  const limited = useRef(false)
  /** Whether the hub's last answer was "busy": a 429 is that, whatever wait it asked for. */
  const busy = useCallback(() => limited.current || Date.now() < busyUntil.current, [])
  /**
   * Runs one hub request, after any Retry-After the hub has asked for; a 429 starts the next wait.
   * Callers waiting on the same Retry-After wake a little apart (WAKE_JITTER_MS), and each looks
   * again when it wakes: one the first of them gets limited again is not followed by the rest.
   * `stillAsked`: whether the request is still wanted once the wait is over (a save for a person
   * who has since gone); when it is not, nothing is sent and the call fails `stale`.
   * A request the hub answers while the layout says "busy" or "offline" (a read that did not
   * get through) is proof it is there: the read goes again, unless `reread` is false: the
   * completion's answer is the end of the onboarding, and a read after it would only say so and
   * take the screen showing what did not go in away.
   */
  const hubCall = useCallback(async (request, { stillAsked, reread = true } = {}) => {
    for (let wait = busyUntil.current - Date.now(); wait > 0; wait = busyUntil.current - Date.now()) {
      await sleep(wait + Math.random() * WAKE_JITTER_MS)
    }
    if (restarting.current || (stillAsked && !stillAsked())) throw Object.assign(new Error('no longer asked'), { status: 0, code: 'stale' })
    try {
      const res = await request()
      limited.current = false
      if (reread && !reading.current && (hubNow.current === 'busy' || hubNow.current === 'offline')) refreshNow.current?.()
      return res
    } catch (e) {
      limited.current = e.status === 429
      if (limited.current) busyUntil.current = Date.now() + waitSeconds(e) * 1000
      throw e
    }
  }, [])

  /** Reads the hub's state again into this tab's. Resolves true once it is in, false if the read failed. */
  const refresh = useCallback(async () => {
    const read = ++reads.current
    // The person it is read for, named to the hub: an answer about someone else is never merged in.
    const person = now.current.uid
    reading.current++
    try {
      const res = await hubCall(() => loadOnboarding(person))
      if (read !== reads.current) return false
      if (res.completedAt != null) { discard(); setHub('complete'); return true }
      act({
        type: 'hub', answers: answersFromHub(res.answers), prefill: res.prefill, next: res.next, remaining: res.remaining,
        coachAvailable: res.coachAvailable, starterAvailable: res.starterAvailable, coachConsent: res.coachConsent,
      })
      setHub('ready')
      return true
    } catch (e) {
      if (read === reads.current) {
        if (e.code === 'wrong-user') signedInElsewhere()
        else if (e.status === 429) setHub('busy')
        else if (hubDown(e)) setHub('offline')
        else { discard(); setHub('unavailable') }
      }
      return false
    } finally {
      reading.current--
    }
  }, [act, discard, hubCall, signedInElsewhere])
  refreshNow.current = refresh

  useEffect(() => {
    if (!uid) { setHub('pre-auth'); return undefined }
    if (!nutritionAvailable(user)) { discard(); setHub('unavailable'); return undefined }
    setHub('loading')
    refresh()
    return () => { reads.current++ }
    // Keyed on the person, not the object: a refreshed user is the same onboarding.
  }, [uid])

  // The hub's saves go one at a time, in the order asked, so an older answer can never land after
  // a newer one (a plan before the training it fits, or arrow keys run through the cards). A step
  // asked again while its save is still waiting to go is not sent twice: that save reads the
  // answers when it goes, so it carries the latest and the last answer wins. With nothing on its
  // way, a save goes at once.
  const tail = useRef(null)
  const waiting = useRef(new Map())

  /**
   * Saves one hub step from the latest answers; a failure marks it to be sent again. The request
   * names the person its answers belong to, read together with them: when someone else has signed
   * in by the time it arrives the hub refuses it (`wrong-user`) and it is dropped, for it is not
   * this person's to send again or to mark unsaved. A refusal with the same person still on this
   * tab is the other way round: the tab is the one out of date (`signedInElsewhere`).
   * The person and their uid are those of the moment it is asked, and a save that comes due after
   * a wait (or after another save) for anyone else sends nothing: it never takes up whoever is
   * signed in by then. Resolves 'saved', 'failed', or 'restarting': the page is starting over,
   * and nothing more is to be sent or shown.
   */
  const saveHubStep = useCallback(step => {
    const person = people.current
    const uid = now.current.uid
    const key = `${person}:${step}`
    const queued = waiting.current.get(key)
    if (queued) return queued
    const send = async () => {
      waiting.current.delete(key)
      if (restarting.current) return 'restarting'
      // Asked for one person, due after another signed in: the answers now are not the ones it was for.
      if (person !== people.current) return 'failed'
      try {
        await hubCall(() => saveStep(step, now.current.answers, uid), { stillAsked: () => person === people.current })
        if (person !== people.current) return 'failed'
        act({ type: 'saved', step, ok: true })
        return 'saved'
      } catch (e) {
        if (restarting.current) return 'restarting'
        if (person !== people.current) return 'failed'
        if (e.code === 'wrong-user') { signedInElsewhere(); return 'restarting' }
        act({ type: 'saved', step, ok: false })
        return 'failed'
      }
    }
    const before = tail.current
    const run = before ? before.then(send) : send()
    if (before) waiting.current.set(key, run)
    tail.current = run
    run.then(() => { if (tail.current === run) tail.current = null })
    return run
  }, [act, hubCall, signedInElsewhere])

  /** Resolves once every save asked for so far has had its answer: 'restarting' if the page is starting over. */
  const savesSettled = useCallback(async () => {
    const last = await (tail.current ?? 'saved')
    return restarting.current ? 'restarting' : last
  }, [])

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
      // About you: what was answered stays, and is saved; with nothing answered the hub takes the
      // step as skipped (api.js stepAnswers), so it does not ask it again either.
      saveHubStep('body')
      act({ type: 'skipYou' })
    }
    if (to) go(to)
  }, [act, go, saveHubStep])

  // The AI coach only with the consent text the hub sent: nobody agrees to a text not shown.
  const coachAvailable = state.coachAvailable === true && state.coachConsent != null
  const starterAvailable = state.starterAvailable === true

  return useMemo(() => ({
    state, hub, screen, coachAvailable, starterAvailable,
    act, saveHubStep, savesSettled, go, back, next, skip, refresh, discard, hubCall, busy, signedInElsewhere,
    restarting: () => restarting.current,
    current: () => now.current,
  }), [state, hub, screen, coachAvailable, starterAvailable, act, saveHubStep, savesSettled, go, back, next, skip, refresh, discard, hubCall, busy, signedInElsewhere])
}
