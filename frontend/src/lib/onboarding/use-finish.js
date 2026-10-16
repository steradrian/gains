import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayISO } from '../format.js'
import { t } from '../i18n.js'
import { completeOnboarding } from './api.js'
import { useOnboarding } from './contexts.js'
import { planOwed } from './flow.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

// Finishing the onboarding, from the Summary's Go to Home (views/onboarding/SummaryScreen.jsx):
// every answer saved, the onboarding completed on the hub (both apps written through its outbox),
// then Home.
//
// What the hub says each app did with its write is said as it is: still on its way only where it
// is being tried again (openGym down or busy), and a write refused for good, or a plan openGym
// could not set up, stays on screen (`setbacks`) with where to put it right.
//
// Nothing completes without the plan the days call for: an AI coach plan (and the consent in it)
// does not survive a reload, so with training days and no plan chosen here or stored on the hub,
// the Plan step is asked again rather than finishing without it.

// The hub's steps in their order: a step's answer can depend on the one before (a plan on the
// training days), so failed saves go again one at a time, in this order.
const HUB_STEPS = ['goal', 'body', 'training', 'plan']
// openGym's write is still queued and tried again: it lands without anything more from the person.
const ON_ITS_WAY = ['pending', 'retrying']

/** What did not go in and needs the person, from the hub's answer to completing; null: nothing. */
function setbacksOf(done) {
  const setbacks = {
    plan: done?.plan?.status === 'refused',
    training: done?.delivery?.opengym === 'failed',
    food: done?.delivery?.nutritrace === 'failed',
  }
  return setbacks.plan || setbacks.training || setbacks.food ? setbacks : null
}

/**
 * { finish, status, setbacks, leave }. status: idle | saving | error | busy (the hub asked to
 * wait). `home()` is how a finished onboarding goes Home (the Summary's hand-over); by default it
 * leaves for /home at once. `leave(to)` drops the flow's state and goes to `to`.
 */
export function useFinish({ home } = {}) {
  const navigate = useNavigate()
  const { act, saveHubStep, savesSettled, go, refresh, discard, current, hubCall, busy, signedInElsewhere, restarting } = useOnboarding()
  const [status, setStatus] = useState('idle')
  const [setbacks, setSetbacks] = useState(null)

  const leave = to => {
    discard()
    navigate(to, { replace: true })
  }
  const toHome = home || (() => leave('/home'))

  // `again`: the second go, after the hub refused a plan and nothing was left to pick instead.
  const finish = async (again = false) => {
    setStatus('saving')
    const owner = current().uid
    // The person who tapped is no longer the one signed in: what follows is not theirs to finish.
    const someoneElse = () => current().uid !== owner
    const fail = () => setStatus(busy() ? 'busy' : 'error')
    // The page starting over (the hub refused a request as another account's, `restarting()`):
    // nothing more is sent or shown here, and the button stays busy until the reload.
    // A save still on its way (a tap just before this one) lands first.
    if ((await savesSettled()) === 'restarting') return
    // No plan chosen for the days given, here or on the hub: asked again, never dropped.
    if (planOwed(current().answers, current().server)) {
      setStatus('idle')
      go('plan')
      return
    }
    // Nothing completes with an answer the hub has not taken: those are sent again first.
    for (const step of HUB_STEPS.filter(s => current().unsaved.includes(s))) {
      const saved = await saveHubStep(step)
      if (saved === 'restarting') return
      if (saved !== 'saved') {
        if (someoneElse()) setStatus('idle')
        else fail()
        return
      }
    }
    let done = null
    try {
      done = await hubCall(() => completeOnboarding(todayISO(), owner), { reread: false })
    } catch (e) {
      if (restarting()) return
      if (e.code === 'wrong-user') {
        // Someone else signed in while this waited: the store has already started over for them,
        // and what is on screen is theirs. Otherwise this tab is the one out of date, and it
        // starts over (the button stays busy until it does): never an idle screen of answers that
        // are no longer the signed-in person's.
        if (someoneElse()) setStatus('idle')
        else signedInElsewhere()
        return
      }
      if (e.code === 'plan-unavailable') {
        // The plan chosen is one this server cannot take (any more), or no longer fits the days:
        // the hub cleared it. With another plan to offer, the Plan step is asked again; with none,
        // it would be a screen of one card, so "no plan" is the answer and this finishes.
        act({ type: 'plan', plan: null })
        // Without the hub's answer there is no knowing what it offers now: try again, from here.
        if (!(await refresh())) {
          if (!restarting()) fail()
          return
        }
        const now = current()
        const offered = !!now.answers.trainingDays && (now.starterAvailable === true || (now.coachAvailable === true && !!now.coachConsent))
        if (!offered && !again) {
          act({ type: 'plan', plan: { kind: 'none' } })
          saveHubStep('plan')
          return finish(true)
        }
        useUI.getState().toast(t('That plan can’t be set up on this server right now. Pick another.'))
        setStatus('idle')
        go('plan')
        return
      }
      if (e.code !== 'complete') { fail(); return }
    }
    // openGym took its write: what it now holds (the plan, the weigh-in, the settings) is read
    // into the app now, so Home shows it. One still on its way comes with the app's next check.
    if (done?.delivery?.opengym === 'done') useStore.getState().pullState()
    const found = setbacksOf(done)
    if (found) {
      setSetbacks(found)
      setStatus('idle')
      return
    }
    if (ON_ITS_WAY.includes(done?.delivery?.opengym)) useUI.getState().toast(t('Saved. Some of it is still on its way to Training and will show up there soon.'))
    toHome()
  }

  return { finish, status, setbacks, leave }
}
