// @vitest-environment happy-dom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { Stage } from './DevScreens.jsx'
import { allScreens, screenAreas, screenById } from './registry.js'
import { todayISO } from '../../lib/format.js'
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

  it('has Today T1.0 to T1.2, its two profiles and the variants T1.9 to T1.15', async () => {
    const ids = screenAreas().find(a => a.name === 'Today').entries.map(e => e.id)
    expect(ids).toEqual(['T1.0', 'T1.1', 'T1.1-failed', 'T1.1-row', 'T1.2', 'T1.E-food', 'T1.E-training', 'T1.9', 'T1.10', 'T1.11', 'T1.12', 'T1.13', 'T1.14', 'T1.15'])
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
    await check('T1.9', h => {
      expect([...h.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).toEqual(['First steps', 'Food', 'Water'])
      expect(h.querySelectorAll('.g-fstep')).toHaveLength(4)
    })
    await check('T1.10', h => expect(h.querySelector('.g-away').textContent).toContain('Welcome back'))
    await check('T1.11', h => expect(h.querySelector('.g-grow').textContent).toMatch(/Workout running · \d+:\d\d.*3 of 6 exercises done.*Resume/))
    await check('T1.12', h => expect(h.querySelector('.g-grow').textContent).toContain('52 min · 18 sets · 2 new bests'))
    await check('T1.13', h => expect(h.querySelector('.g-grow').textContent).toContain('Next: Legs, tomorrow'))
    await check('T1.14', h => expect(h.querySelector('.g-saved-stage').textContent).toBe('Offline · 3 changes waiting'))
    await check('T1.15', h => expect(h.querySelector('.g-rc-slide').textContent).toContain('kcal over 2,100'))
  })

  it('has the Today drawers and toasts T1.3 to T1.8, each over the Today screen', async () => {
    const ids = screenAreas().find(a => a.name === 'Today: drawers and toasts').entries.map(e => e.id)
    expect(ids).toEqual(['T1.3', 'T1.3p', 'T1.3e', 'T1.4', 'T1.4e', 'T1.4p', 'T1.5', 'T1.6', 'T1.7', 'T1.8'])
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ host, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    for (const id of ids) await check(id, s => expect(s.host.querySelectorAll('.g-rc-slide'), id).toHaveLength(4))
    await check('T1.4', s => {
      expect(s.drawer.querySelector('.g-bs-chip').textContent).toContain('Lunch')
      expect(s.drawer.textContent).toContain('Create a food')
    })
    await check('T1.3', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Nutrition today')
      expect(s.drawer.querySelectorAll('.g-nd-pct').length).toBeGreaterThan(0)
    })
    await check('T1.3p', s => expect(s.drawer.querySelector('.g-seg [aria-pressed="true"]').textContent).toBe('Protein'))
    await check('T1.3e', s => {
      expect(s.drawer.querySelector('.g-nd-num').textContent).toBe('0')
      expect(s.drawer.querySelectorAll('.g-nd-add')).toHaveLength(4)
    })
    await check('T1.8', s => expect([...s.drawer.querySelectorAll('.g-atile')].map(b => b.textContent))
      .toEqual(['Log food', 'Scan', 'Water', 'Weigh-in', 'Start workout', 'Log activity']))
    await check('T1.4e', s => expect(s.drawer.textContent).toContain('Suggested foods'))
    await check('T1.4p', s => expect(s.drawer.querySelector('.g-bs-chip').textContent).not.toMatch(/^Today/))
    await check('T1.5', s => expect(s.host.textContent).toContain('Added Chicken rice bowl to Today, Lunch'))
    await check('T1.6', s => expect(s.host.textContent).toContain('Added 250 ml of water to Today'))
    await check('T1.7', s => expect(s.drawer.textContent).toContain('Save weigh-in'))
  }, 20000)

  it('has the search H0.0 to H0.9, its Open Food Facts rows and T6.9, each the real header over the real panel', async () => {
    const ids = screenAreas().find(a => a.name === 'Shared: search').entries.map(e => e.id)
    expect(ids).toEqual(['H0.0', 'H0.1', 'H0.2', 'H0.3', 'H0.4', 'H0.4-searching', 'H0.4-error', 'H0.4-offline', 'H0.5', 'H0.6', 'H0.7', 'H0.8', 'H0.9', 'T6.9'])
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ host, text: host.textContent, panel: host.querySelector('#gains-search') })
      unmountAll()
    }
    for (const id of ids) {
      await check(id, s => {
        expect(s.host.querySelector('.g-shdr-pin .g-bell').getAttribute('aria-label'), id).toBe('Close search')
        expect(s.panel, id).not.toBeNull()
      })
    }
    await check('H0.0', s => expect([...s.panel.querySelectorAll('.g-ssect h2')].map(h => h.textContent)).toEqual(expect.arrayContaining(['Go to', 'Recent', 'Suggested'])))
    await check('H0.1', s => expect(s.panel.querySelector('.g-sempty b').textContent).toBe('Search everything'))
    await check('H0.2', s => expect([...s.panel.querySelectorAll('.g-goto-chip')].map(c => c.textContent)).toEqual(['Routines', 'Plan', 'Strength', 'Workout settings']))
    await check('H0.3', s => expect([...s.panel.querySelectorAll('.g-goto-chip')].map(c => c.textContent)).toEqual(['Saved meals', 'Recipes', 'Trends', 'Days']))
    await check('H0.4', s => expect(s.panel.querySelector('.g-rchips')).not.toBeNull())
    await check('H0.4-searching', s => expect(s.panel.textContent).toContain('Searching Open Food Facts…'))
    await check('H0.4-error', s => expect(s.panel.textContent).toContain('Couldn’t reach Open Food Facts'))
    await check('H0.6', s => expect(s.panel.textContent).toContain('Did you mean'))
    await check('H0.9', s => expect(s.panel.textContent).toContain('Did you mean'))
    await check('H0.4-offline', s => expect(s.panel.textContent).not.toContain('Open Food Facts'))
    await check('H0.5', s => expect(s.host.querySelector('.g-ssf-scope').textContent).toBe('Workouts'))
    await check('H0.7', s => expect(s.text).toContain('Recent searches cleared'))
    await check('H0.8', s => expect(s.panel.querySelector('.g-sfeat').textContent).toContain('Fasting'))
  }, 30000)

  it('a search state leaves the real user\'s search history as it was: in storage and on screen after', async () => {
    const realUser = useStore.getState().user
    const KEYS = { 'gains_search_recent:u77': JSON.stringify([{ kind: 'query', query: 'deadlift' }]), 'gains_search_opened:u77': JSON.stringify({ 'page:/home': { n: 2, at: 1 } }), 'gains_search_searched:u77': 'true' }
    useStore.setState({ user: { id: 77, name: 'Real' } })
    for (const [k, v] of Object.entries(KEYS)) localStorage.setItem(k, v)
    try {
      await show(screenById('H0.0'))
      unmountAll()
      for (const [k, v] of Object.entries(KEYS)) expect(localStorage.getItem(k), k).toBe(v)
      const { useRecents } = await import('../../lib/search/recents.js')
      expect(useRecents.getState()).toMatchObject({ profile: 'u77', list: [{ kind: 'query', query: 'deadlift' }], searched: true })
    } finally {
      useStore.setState({ user: realUser })
      for (const k of Object.keys(KEYS)) localStorage.removeItem(k)
    }
  })

  it('has Train T2.0 and its states T2.3 and T2.7 to T2.14, the toasts held over the screen', async () => {
    const ids = screenAreas().find(a => a.name === 'Train').entries.map(e => e.id)
    expect(ids).toEqual(['T2.0', 'T2.3', 'T2.7', 'T2.8', 'T2.9', 'T2.10', 'T2.11', 'T2.12', 'T2.13', 'T2.14'])
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const eyebrow = h => h.querySelector('.g-tcard-tags').textContent
    await check('T2.0', h => {
      expect(h.querySelectorAll('.g-rc-slide')).toHaveLength(3)
      expect([...h.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).toEqual(['Routines', 'Your training'])
      expect(eyebrow(h)).toBe('Today · planned')
      expect(h.querySelectorAll('.g-rtile')).toHaveLength(4)
    })
    await check('T2.3', h => expect(eyebrow(h)).toBe('Mon 19 Oct · planned'))
    await check('T2.7', h => expect(eyebrow(h)).toMatch(/^In progress · \d+:\d\d$/))
    await check('T2.8', h => {
      expect(h.querySelector('.train-banner').textContent).toContain('You missed Legs on Fri 16 Oct')
      expect(h.querySelector('.g-rd-missed')).toBeTruthy()
    })
    await check('T2.9', h => {
      expect(h.querySelector('.g-rail')).toBeNull()
      expect(h.querySelector('.g-sempty').textContent).toContain('Add training')
    })
    await check('T2.10', h => expect(eyebrow(h)).toBe('Workout done'))
    await check('T2.11', h => expect(eyebrow(h)).toBe('Rest day'))
    await check('T2.12', h => expect(h.textContent).toContain('Moved Legs to today. Push A is now Tue 20 Oct'))
    await check('T2.13', h => expect(h.textContent).toContain('Skipped Legs on Fri 16 Oct. Push A stays today'))
    await check('T2.14', h => {
      expect(eyebrow(h)).toBe('Sat 24 OctPlanned')
      expect(h.querySelector('.g-rail-title').textContent).toBe('Next week')
      expect(h.querySelectorAll('.g-tcard-rows .g-xrow')).toHaveLength(6)
    })
  }, 20000)

  it('has the Train drawers T2.1 and T2.2, open over Train, and gives the store its own state back', async () => {
    const ids = screenAreas().find(a => a.name === 'Train: drawers').entries.map(e => e.id)
    expect(ids).toEqual(['T2.1', 'T2.1e', 'T2.2'])
    const own = useStore.getState().S
    const drawer = async id => {
      const host = await show(screenById(id))
      expect(host.querySelector('.g-tcard'), id + ' is open over T2.0').toBeTruthy()
      return host.querySelector('.g-bs')
    }
    const names = d => [...d.querySelectorAll('.g-tr-b > b')].map(b => b.textContent)
    expect(names(await drawer('T2.1'))).toEqual(['Push A, Planned today', 'Pull A', expect.stringMatching(/^Legs, Missed /), 'Freestyle', 'Repeat a past workout'])
    unmountAll()
    expect(names(await drawer('T2.1e'))).toEqual(['Pick a ready-made plan', 'Create a routine', 'Import a plan file', 'Freestyle'])
    unmountAll()
    const options = await drawer('T2.2')
    expect(options.querySelector('h2').textContent).toMatch(/ · Push A$/)
    expect(options.textContent).toContain('Shoulder felt tight')
    unmountAll()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
  }, 20000)

  it('a tap in a mocked state changes memory only: the real saved copy is untouched and nothing is pushed', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const realUpdate = useStore.getState().update
    const host = await show(screenById('T2.2'))
    const rest = [...host.querySelectorAll('.g-bs button')].find(b => b.textContent.startsWith('Rest / skip this day'))
    rest.click()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S.dayPlan).toMatchObject({ [todayISO()]: 'rest' })
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
    unmountAll()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().update).toBe(realUpdate)
    localStorage.removeItem('gym_state_v1')
  }, 10000)

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
