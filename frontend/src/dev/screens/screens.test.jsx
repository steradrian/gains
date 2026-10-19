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
