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
