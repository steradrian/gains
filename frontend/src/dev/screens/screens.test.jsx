// @vitest-environment happy-dom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { Stage } from './DevScreens.jsx'
import { allScreens, screenAreas, screenById } from './registry.js'
import { useStore } from '../../store/useStore.js'

/* The screens gallery: every registered state renders its real screen, in its frame, with its
   taps played, without throwing; and putting the mocks away leaves the app as it was. The states
   play on timers, like a person tapping, so this does not run inside act(). */
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const states = allScreens()
const mounted = []
const unmountAll = () => { mounted.splice(0).forEach(({ root, host }) => { root.unmount(); host.remove() }) }
afterEach(unmountAll)

async function show(entry) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push({ root, host })
  let played
  // A tap that finds nothing to tap is a failure of the state, not a quiet blank.
  const done = new Promise((resolve, reject) => { played = error => (error ? reject(error) : resolve()) })
  root.render(<Stage entry={entry} onPlayed={played} />)
  await done
  // One more beat for the last tap's answer to land.
  await new Promise(resolve => setTimeout(resolve, 150))
  return host
}

describe('the screens gallery', () => {
  it('has the eleven sign-in states S0.0 to S0.10 and the configurations the boards do not draw', () => {
    const ids = screenAreas().find(a => a.name === 'Sign in').entries.map(e => e.id)
    for (let n = 0; n <= 10; n++) expect(ids).toContain('S0.' + n)
    expect(allScreens().map(e => e.id)).toEqual(expect.arrayContaining(['S0.demo', 'S0.guest', 'S0.open']))
  })

  it('has the onboarding entry states O1.0 to O1.5, O2.1, O2.1e, O2.1t and O2.2', () => {
    const ids = screenAreas().find(a => a.name === 'Onboarding: the entry').entries.map(e => e.id)
    expect(ids).toEqual(['O1.0', 'O1.1', 'O1.2', 'O1.3', 'O1.4', 'O1.5', 'O2.1', 'O2.1e', 'O2.1t', 'O2.2'])
  })

  it('shows each onboarding entry state it names', async () => {
    // One at a time: a frame left up would see the next state's signed-in user and check again.
    const text = async id => {
      const shown = (await show(screenById(id))).textContent
      unmountAll()
      return shown
    }
    expect(await text('O1.0')).toContain('Andrei invited you to Gains')
    expect(await text('O1.1')).toContain('Opening your invite')
    expect(await text('O1.2')).toContain('This invite has expired')
    expect(await text('O1.3')).toContain('This invite was already used')
    expect(await text('O1.4')).toContain('You’re offline')
    expect(await text('O1.5')).toContain('Signed in as Alex')
    expect(await text('O2.1')).toContain('What should we call you?')
    expect(await text('O2.1e')).toContain('No passkey created. Try again.')
    expect(await text('O2.1t')).toContain('Passkeys need Safari or Chrome')
    expect(await text('O2.2')).toContain('Passkey saved')
  })

  it('has the onboarding questions O2.3 to O2.9, metric and imperial, with and without the coach', () => {
    const ids = screenAreas().find(a => a.name === 'Onboarding: the questions').entries.map(e => e.id)
    expect(ids).toEqual(['O2.3', 'O2.3p', 'O2.4', 'O2.4w', 'O2.5', 'O2.5i', 'O2.6', 'O2.6i', 'O2.7', 'O2.7i', 'O2.8', 'O2.8z', 'O2.9', 'O2.9n'])
  })

  it('shows each onboarding question state it names', async () => {
    // One at a time, as the entry's: a frame left up would answer for the next.
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('O2.3', s => expect(s.text).toContain('Pick a goal to balance food and training'))
    await check('O2.3p', s => expect(s.host.querySelector('[role="radio"][aria-checked="true"]').textContent).toContain('Lose weight'))
    await check('O2.4', s => expect(s.text).toContain('kcal a day'))
    await check('O2.4w', s => expect(s.text).toContain('Bodies at rest burn energy'))
    await check('O2.6', s => expect(s.host.querySelector('[role="slider"]').getAttribute('aria-valuemax')).toBe('230'))
    await check('O2.6i', s => expect(s.host.querySelector('[role="slider"]').getAttribute('aria-valuemax')).toBe('90'))
    await check('O2.7i', s => expect(s.host.querySelector('.ob-pk-num small').textContent).toBe('lb'))
    await check('O2.8', s => expect(s.host.querySelectorAll('.g-week-disc.on')).toHaveLength(4))
    await check('O2.8z', s => expect(s.host.querySelectorAll('.g-week-disc.on')).toHaveLength(0))
    await check('O2.9', s => expect(s.text).toContain('Have the AI coach build one'))
    await check('O2.9n', s => {
      expect(s.text).not.toContain('Have the AI coach build one')
      expect(s.host.querySelectorAll('[role="radio"]')).toHaveLength(2)
    })
  })

  it('has the onboarding endings O2.10 to O2.16, with the starter\'s, the coach\'s and the Summary\'s drawers', () => {
    const ids = screenAreas().find(a => a.name === 'Onboarding: the endings').entries.map(e => e.id)
    expect(ids).toEqual(['O2.10', 'O2.10f', 'O2.11', 'O2.12', 'O2.12a', 'O2.12d', 'O2.13', 'O2.14', 'O2.15', 'O2.16'])
  })

  it('shows each onboarding ending it names', async () => {
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('O2.10', s => {
      expect(s.text).toContain('Upper / lower')
      expect(s.host.querySelectorAll('.ob-pill')).toHaveLength(4)
    })
    await check('O2.10f', s => expect(s.text).toContain('Exercises swap for what you have'))
    await check('O2.11', s => expect(s.text).toContain('Tapping Build my plan sends them once.'))
    await check('O2.12', s => {
      expect(s.host.querySelector('.ob-sum-v').textContent).toBe('2,100')
      expect(s.host.querySelectorAll('.g-week-disc.on')).toHaveLength(4)
    })
    await check('O2.12a', s => expect(s.text).toContain('Fixed keeps it where you set it.'))
    await check('O2.12d', s => expect(s.text).toContain('Shop floor, classroom, lots of walking'))
    await check('O2.13', s => expect(s.text).toContain('Your AI coach is on it'))
    await check('O2.14', s => expect(s.text).toContain('Choose a plan any time in Train'))
    await check('O2.15', s => expect(s.text).toContain('Add training any time in Settings'))
    await check('O2.16', s => expect(s.text).toContain('Set your target'))
  }, 15000)

  it('puts back what the onboarding kept for this tab, and whether the browser is online', async () => {
    sessionStorage.setItem('gains_onboarding', '{"uid":"someone"}')
    await show(screenById('O1.4'))
    expect(navigator.onLine).toBe(false)
    unmountAll()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(navigator.onLine).toBe(true)
    expect(sessionStorage.getItem('gains_onboarding')).toBe('{"uid":"someone"}')
    sessionStorage.clear()
  })

  it('has Today T1.0 to T1.2 and its two profiles', async () => {
    const ids = screenAreas().find(a => a.name === 'Today').entries.map(e => e.id)
    expect(ids).toEqual(['T1.0', 'T1.1', 'T1.2', 'T1.E-food', 'T1.E-training'])
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('T1.0', h => {
      expect(h.querySelectorAll('.g-rc-slide')).toHaveLength(4)
      expect([...h.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).toEqual(['Up next', 'Food', 'Water'])
    })
    await check('T1.1', h => expect(h.querySelector('.g-rcb[aria-busy="true"]')).toBeTruthy())
    await check('T1.E-food', h => expect(h.querySelector('.g-grow')).toBeNull())
    await check('T1.E-training', h => {
      expect(h.querySelectorAll('.g-rc-slide')).toHaveLength(1)
      expect(h.querySelectorAll('.g-wk-cell')).toHaveLength(7)
      expect(h.querySelector('.g-tiles')).toBeNull()
    })
  })

  it('has a unique id and a title for every state', () => {
    expect(new Set(states.map(e => e.id)).size).toBe(states.length)
    for (const e of states) { expect(e.title, e.id).toBeTruthy(); expect(screenById(e.id)).toBe(e) }
  })

  it.each(states.map(e => [e.id + ' ' + e.title, e]))('renders %s without throwing', async (_name, entry) => {
    const host = await show(entry)
    expect(host.querySelector('.dsg-frame').textContent.length).toBeGreaterThan(0)
  })

  it('shows the state it names, not the one before', async () => {
    const text = async id => (await show(screenById(id))).textContent
    expect(await text('S0.2')).toContain('Your passkey could not be confirmed.')
    expect(await text('S0.1')).toContain('Waiting for your passkey')
    expect(await text('S0.3')).toContain('Passkeys need Safari or Chrome')
    expect(await text('S0.4')).toContain('Enter the code your other device shows')
    expect(await text('S0.5')).toContain('That code didn’t work')
    expect(await text('S0.6')).toContain('Alex’s profile')
    expect(await text('S0.8')).toContain('Wrong name, e-mail or password.')
    expect(await text('S0.7a')).toContain('This account has been disabled.')
    expect(await text('S0.9')).toContain('Set password and sign in')
    expect(await text('S0.10')).toContain('This browser can’t use passkeys')
    expect(await text('S0.demo')).toContain('Start the demo')
  })

  it('puts the store, the network and the passkey prompt back as it found them', async () => {
    const before = { fetch: globalThis.fetch, setUser: useStore.getState().setUser, config: useStore.getState().config, user: useStore.getState().user }
    await show(screenById('S0.6'))
    unmountAll()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(globalThis.fetch).toBe(before.fetch)
    expect(useStore.getState().setUser).toBe(before.setUser)
    expect(useStore.getState().config).toBe(before.config)
    expect(useStore.getState().user).toBe(before.user)
  })
})
