// @vitest-environment happy-dom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The gallery draws the Coach's own screens and the onboarding offer with the Coach on.
vi.mock('../../lib/coach-availability.js', () => ({ COACH_COMING_SOON: false }))
import { Stage } from './DevScreens.jsx'
import { allScreens, screenAreas, screenById } from './registry.js'
import { todayISO } from '../../lib/format.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'

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

  it('has the Notifications page N1.0 to N1.3', async () => {
    const ids = screenAreas().find(a => a.name === 'Shared: notifications').entries.map(e => e.id)
    expect(ids).toEqual(['N1.0', 'N1.1', 'N1.1w', 'N1.2', 'N1.3'])
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('N1.0', h => {
      expect([...h.querySelectorAll('.g-ngroup h2')].map(e => e.textContent)).toEqual(['New', 'This week', 'Earlier'])
      expect(h.querySelectorAll('.g-nrow-dot')).toHaveLength(2)
    })
    await check('N1.1', h => expect(h.querySelector('.g-sempty').textContent).toContain('Set a reminder'))
    await check('N1.1w', h => {
      expect(h.querySelector('.g-sempty').textContent).not.toMatch(/reminder/i)
      expect(h.querySelector('.g-sempty-btn')).toBeNull()
    })
    await check('N1.2', h => {
      expect(h.querySelector('.g-ssec-line')).toBeNull()
      expect(h.querySelector('.g-nrow-dot')).toBeNull()
    })
    await check('N1.3', h => {
      expect(h.querySelector('.g-sbanner').textContent).toContain('Notifications are off on this phone')
      expect(h.querySelectorAll('.g-nrow')).toHaveLength(4)
    })
  })

  // Shared: week
  it('has the Week page D2.0, D2.1 and a week with nothing', async () => {
    const ids = screenAreas().find(a => a.name === 'Shared: week').entries.map(e => e.id)
    expect(ids).toEqual(['D2.0', 'D2.1', 'D2.E-empty'])
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('D2.0', h => {
      expect(h.querySelector('.week-ring-t').textContent).toContain('workouts · Push A is today')
      expect(h.querySelectorAll('.g-swc-cell')).toHaveLength(7)
      expect(h.querySelectorAll('.g-stat')).toHaveLength(8)
      expect(h.querySelector('.week-nav-off')).toBeTruthy()
    })
    await check('D2.1', h => {
      expect(h.querySelector('.week-head').textContent).toContain('Week 41 · complete')
      expect(h.querySelector('.g-w4-cell.on').getAttribute('aria-label')).toBe('Week of 5 Oct, 3 of 4 workouts')
    })
    await check('D2.E-empty', h => {
      expect([...h.querySelectorAll('.g-stat b')].every(b => b.textContent === '–')).toBe(true)
      expect(h.querySelectorAll('.g-w4-cell')).toHaveLength(4)
    })
  })

  // Shared: day
  it('has the Day page D1.0 to D1.7, the drawers open and the toast held over the day', async () => {
    const ids = screenAreas().find(a => a.name === 'Shared: day').entries.map(e => e.id)
    expect(ids).toEqual(['D1.0', 'D1.1', 'D1.2', 'D1.3', 'D1.4', 'D1.5', 'D1.6', 'D1.7'])
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('D1.0', h => {
      expect(h.querySelector('.g-sptitle h1').textContent).toBe('Mon 12 Oct')
      expect(h.querySelectorAll('.g-wcard-ex')).toHaveLength(6)
      expect(h.querySelector('.g-dfood-num').textContent).toContain('On target')
    })
    await check('D1.1', h => expect(h.querySelector('.g-dstat').textContent).toContain('Pull A was next'))
    await check('D1.2', h => expect([...h.querySelectorAll('.g-dstat-btn')].map(b => b.textContent)).toEqual(['Add past workout', 'Mark skipped']))
    await check('D1.3', h => expect(h.querySelectorAll('.g-sempty-btn')).toHaveLength(3))
    await check('D1.4', h => expect(h.querySelector('.g-dstat-off').textContent).toContain('Tracking off'))
    await check('D1.5', h => {
      const drawer = h.querySelector('.g-bs')
      expect(drawer.querySelector('.g-bs-chip').textContent).toContain('Mon 12 Oct')
      expect(drawer.textContent).toContain('Add past workout')
      expect(drawer.querySelector('.g-bs-note').textContent).toContain('Everything here goes to Mon 12 Oct.')
    })
    await check('D1.6', h => {
      const drawer = h.querySelector('.g-bs')
      expect(drawer.querySelector('h2').textContent).toBe('Add past workout')
      expect(drawer.querySelector('[role="radio"][aria-checked="true"]').textContent).toContain('Legs')
      expect(drawer.querySelector('.g-bs-foot').textContent).toContain('Log Legs for Fri 16 Oct')
    })
    await check('D1.7', h => {
      expect(h.querySelector('.g-dstat .g-tag').textContent).toBe('Skipped')
      expect(h.textContent).toContain('Marked Legs skipped on Fri 16 Oct')
    })
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

  it('has Train slice 5\'s History states, and its delete and Undo stay in memory', async () => {
    const ids = screenAreas().find(a => a.name === 'Train slice 5').entries.map(e => e.id)
    expect(ids).toEqual(['T8.0', 'T8.2', 'T8.1', 'T8.1r', 'T8.3', 'T8.4', 'T9.0', 'T9.1', 'T9.2', 'T9.3', 'T9.0a', 'T9.4', 'T9.5', 'T9.5e', 'T9.E', 'T9.6'])
    const own = useStore.getState().S
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('T8.0', h => {
      expect(h.querySelector('.g-mg')).toBeTruthy()
      expect([...h.querySelectorAll('.g-hist-week .g-ssec h2')][0].textContent).toBe('This week')
      expect(h.textContent).toContain('Away for work')
    })
    await check('T8.2', h => expect(h.querySelector('.g-sempty').textContent).toContain('No workouts yet'))
    await check('T8.1', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Push A')
      expect(h.querySelector('.g-bs textarea').value).toBe('Felt strong. Bench moved fast.')
    })
    await check('T8.1r', h => expect(h.querySelector('.g-bs').textContent).toContain('Finish the current workout first.'))
    await check('T8.3', h => expect(h.querySelector('.g-bs h2').textContent).toBe('Share workout'))
    await check('T8.4', h => {
      expect(h.textContent).toMatch(/Deleted Push A from /)
      expect(h.querySelectorAll('.g-hist-row')).toHaveLength(8)   // 7 workouts and the day note
    })
    await check('T9.0', h => {
      expect(h.querySelector('.g-spage-title').textContent).toBe('Training load')
      expect(h.querySelector('.g-heat')).toBeTruthy()
      expect(h.querySelectorAll('[data-muscle-volume]')).toHaveLength(4)
    })
    await check('T9.2', h => expect(h.querySelector('.g-load-period').textContent).toBe('Last 30 days'))
    await check('T9.3', h => expect(h.querySelector('.g-load-more').textContent).toBe('Show less'))
    await check('T9.0a', h => expect(h.textContent).toContain('Every muscle group got some work in this period.'))
    await check('T9.4', h => expect(h.textContent).toContain('Fatigue shows how recently each muscle was trained.'))
    await check('T9.5e', h => expect(h.textContent).toContain('No exercises with an estimated 1RM yet.'))
    await check('T9.E', h => expect(h.querySelector('.g-load-effort')).toBeTruthy())
    await check('T9.6', h => expect(h.querySelector('.g-stats')).toBeTruthy())
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
    localStorage.removeItem('gym_state_v1')
  }, 20000)

  it('has Train › Routines T4.0, T4.1, T4.3 (toast held) and T4.4, and the menu’s drawers over the routine’s page', async () => {
    expect(screenAreas().find(a => a.name === 'Train: routines').entries.map(e => e.id))
      .toEqual(['T4.0', 'T4.1', 'T4.3', 'T4.4', 'T5.0', 'T5.0-pull', 'T5.0-legs', 'T5.0-reorder', 'T5.0-offline', 'T5.4', 'T5.6'])
    expect(screenAreas().find(a => a.name === 'Train: routines drawers').entries.map(e => e.id)).toEqual(['T5.8', 'T5.8-days', 'T5.8-share', 'T5.8-settings'])
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const titles = h => [...h.querySelectorAll('.g-ssec h2')].map(e => e.textContent)
    await check('T4.0', h => {
      expect(h.querySelector('.g-spage-sub').textContent).toBe('5 routines · 3 in your Plan')
      expect(titles(h)).toEqual(['In your Plan', 'Not in your Plan', 'No routine'])
      expect(h.textContent).toContain('7 exercises · imported from Upper Lower')
      expect(h.textContent).toContain('5 exercises · not done yet')
    })
    await check('T4.1', h => expect(h.querySelector('.g-sempty').textContent).toContain('No routines yet'))
    await check('T4.3', h => expect(h.textContent).toContain('Deleted Push A. Sun and Thu are now rest days'))
    await check('T4.4', h => {
      expect(titles(h)[0]).toBe('Added from Upper Lower')
      expect(h.querySelector('.g-spage-sub').textContent).toBe('9 routines · 3 in your Plan')
      expect(h.textContent).toContain('Added 4 routines from Upper Lower')
    })
    await check('T5.8', h => expect(h.querySelector('.g-bs h2').textContent).toBe('Push A'))
    await check('T5.8-days', h => expect(h.querySelectorAll('.g-bs [role="checkbox"]')).toHaveLength(7))
    await check('T5.8-share', h => expect(h.querySelector('.g-bs').textContent).toContain('As a plan file'))
    await check('T5.8-settings', h => expect(h.querySelector('.g-bs [role="switch"]')).toBeTruthy())
    const sync = useStore.getState().sync
    await check('T5.0', h => {
      expect(h.querySelector('.g-snav').textContent).toContain('Push A')
      expect(h.querySelector('.g-re-plan').textContent).toBe('In your Plan · Sun, Thu')
      expect(h.querySelector('.g-re-stats').textContent).toMatch(/^6 exercises · 19 sets · about /)
      expect(h.querySelectorAll('.g-re-list [data-routine-row]')).toHaveLength(6)
      expect(h.querySelector('.g-ssg-h').textContent).toMatch(/rest after both/)
      expect(h.querySelector('.g-rx-prog').textContent).toBe('Up 2.5 kg when every set hits 8')
      expect(h.querySelector('.g-re-start').textContent).toBe('Start Push A')
    })
    await check('T5.0-pull', h => expect(h.querySelector('.g-re-plan').textContent).toBe('In your Plan · Wed'))
    await check('T5.0-legs', h => expect(h.querySelector('.g-re-plan').textContent).toBe('In your Plan · Mon, Sat'))
    await check('T5.0-reorder', h => expect(h.querySelectorAll('.g-rx-btn')).toHaveLength(12))
    await check('T5.0-offline', h => expect(h.querySelector('.g-saved').textContent).toBe('Offline'))
    expect(useStore.getState().sync).toBe(sync)
    await check('T5.4', h => {
      expect(h.querySelectorAll('.g-re-list [data-routine-row]')).toHaveLength(7)
      expect(useUI.getState().toastMsg).toMatch(/^Added .+ to Push A$/)
    })
    await check('T5.6', h => {
      expect(h.querySelector('.g-sempty').textContent).toContain('Nothing in it yet')
      expect(document.activeElement).toBe(h.querySelector('.g-tfield input'))
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
  }, 20000)

  it('has Train plan T3.0 (loop, fixed week, someone else’s, editing), T3.2 and T3.3, and gives the store its own state back', async () => {
    const ids = screenAreas().find(a => a.name === 'Train: plan').entries.map(e => e.id)
    expect(ids).toEqual(['T3.0', 'T3.0w', 'T3.0x', 'T3.0e', 'T3.2', 'T3.3'])
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const heads = h => [...h.querySelectorAll('h2')].map(e => e.textContent)
    await check('T3.0', h => {
      expect(h.querySelector('.g-spage-title').textContent).toBe('Plan')
      expect(h.querySelector('.g-spage-sub').textContent).toBe('Push A, Pull A, Legs')
      expect(heads(h)).toEqual(expect.arrayContaining(['Your loop', 'This week', 'Next week', 'Weekly muscle volume']))
      expect(h.querySelector('.g-loop-chip.on').textContent).toContain('Push A')
      expect(h.querySelectorAll('.g-pcell')).toHaveLength(14)
    })
    await check('T3.0w', h => {
      expect(heads(h)).toContain('Your week')
      expect(h.querySelector('.g-spage-sub').textContent).toMatch(/ · 4 days a week$/)
    })
    await check('T3.0x', h => {
      expect(h.querySelector('.g-sseg')).toBeNull()
      expect(h.textContent).toContain('Externally managed')
    })
    await check('T3.0e', h => expect(h.querySelectorAll('.plan-erow')).toHaveLength(3))
    await check('T3.2', h => expect(h.querySelector('.g-ibanner').textContent).toContain('Coach suggests 2 changes'))
    await check('T3.3', h => {
      expect(h.querySelector('.g-sempty b').textContent).toBe('No rotation yet')
      expect(h.querySelector('.plan-volume')).toBeNull()
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
  }, 20000)

  it('has Train › Routines picker: the picker (a row ticked, no exact match, Favourites, By muscle), the settings (flat and pyramid) and Replace', async () => {
    expect(screenAreas().find(a => a.name === 'Train: routines picker').entries.map(e => e.id))
      .toEqual(['T5.1', 'T5.1-nomatch', 'T5.2', 'T5.3', 'T5.5', 'T5.5-pyramid', 'T5.7'])
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('T5.1', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Add exercise')
      expect(h.querySelector('.g-bs-chip').textContent).toBe('Push A')
      expect(h.querySelector('.g-bs-foot').textContent).toBe('Add 1 exercise to Push A')
      expect(h.querySelectorAll('.g-pk-item button[aria-pressed="true"]')).toHaveLength(1)
    })
    await check('T5.1-nomatch', h => {
      expect(h.querySelector('.g-bs .g-pk-head').textContent).toBe('No exact match. These come close:')
      expect(h.querySelector('.g-bs .g-pk-list').lastElementChild.classList.contains('g-pk-new')).toBe(true)
    })
    await check('T5.2', h => expect(h.querySelectorAll('.g-bs .g-pk-item')).toHaveLength(4))
    await check('T5.3', h => expect(h.querySelector('.g-bs .g-pk-head').textContent).toMatch(/^Chest · \d/))
    await check('T5.5', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('barbell bench press')
      expect(h.querySelectorAll('.g-bs .g-sett [role="row"]')).toHaveLength(2)
      expect(h.querySelector('.g-bs').textContent).toContain('Undo for 8 s')
      expect(h.querySelector('.g-bs').textContent).toContain('Superset with the exercise above')
    })
    await check('T5.5-pyramid', h => expect(h.querySelectorAll('.g-bs .g-sett [role="row"]')).toHaveLength(4))
    await check('T5.7', h => {
      expect(h.querySelector('.g-bs h2').textContent).toMatch(/^Replace /)
      expect(h.querySelector('.g-bs').textContent).toContain('you did 30 kg × 10')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
  }, 20000)

  // T4.4, where the import lands, is the Routines page's and is checked with it above.
  it('has the Plan drawers T3.1 to T3.6 open over the Plan route and the import page T3.7, all in memory', async () => {
    const ids = screenAreas().find(a => a.name === 'Train: plan drawers').entries.map(e => e.id)
    expect(ids).toEqual(['T3.1', 'T3.1e', 'T3.1p', 'T3.4', 'T3.5', 'T3.6', 'T3.7', 'T3.7e'])
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ host, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    await check('T3.1', s => {
      expect(s.drawer.querySelectorAll('.g-seg button')).toHaveLength(2)
      expect(s.drawer.querySelector('[role=radiogroup]')).toBeTruthy()
    })
    await check('T3.1e', s => expect(s.drawer.querySelectorAll('[role=checkbox]').length).toBeGreaterThan(1))
    await check('T3.1p', s => {
      expect(s.drawer.querySelector('.g-seg')).toBeNull()
      expect(s.drawer.textContent).toContain('Log this workout')
    })
    await check('T3.4', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Day note')
      expect(s.drawer.querySelector('textarea').value).toContain('Shoulder felt tight')
    })
    await check('T3.5', s => expect(s.drawer.querySelector('h2').textContent).toBe('Plan'))
    await check('T3.6', s => expect(s.drawer.querySelector('.g-tr3-card span').textContent).toBe('Push A · Pull A · Legs · 9 exercises'))
    await check('T3.7', s => expect(s.host.textContent).toContain('4 routines · 16 exercises · 4 days a week'))
    await check('T3.7e', s => expect(s.host.textContent).toContain('Couldn’t read that file.'))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
    localStorage.removeItem('gym_state_v1')
  }, 30000)

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

// Workout core-M3
describe('the screens gallery: the running workout', () => {
  const IDS = ['W1.0', 'W1.2', 'W1.6', 'W1.35', 'W1.32', 'W1.3', 'W1.5', 'W1.7', 'W1.8', 'W1.36', 'W1.24', 'W1.38', 'W1.39',
    'W1.41', 'W1.42', 'W1.9', 'W1.28', 'W1.28b', 'W1.29', 'W1.29b', 'W1.30', 'W1.44']

  it('has every running-workout state under its board id', () => {
    // The area is shared with the progression states (W1.47 to W1.51, tested below).
    expect(screenAreas().find(a => a.name === 'Workout').entries.map(e => e.id).filter(id => IDS.includes(id))).toEqual(IDS)
  })

  it('shows each state it names and leaves no rest, hold or session behind', async () => {
    const own = useStore.getState().S.active
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('W1.0', s => { expect(s.text).toContain('Cable Middle Fly'); expect(s.text).toContain('Done set'); expect(s.text).toContain('Trained so far') })
    await check('W1.2', s => expect(s.text).toContain('Warm-up done'))
    await check('W1.3', s => expect(s.host.querySelector('.g-wf-rest')).not.toBeNull())
    await check('W1.5', s => expect(s.text).toContain('Go · set'))
    await check('W1.8', s => { expect(s.text).toContain('NEW BEST'); expect(s.text).toContain('Trend') })
    await check('W1.36', s => expect(s.text).toContain('Back to Cable Middle Fly · set 2'))
    await check('W1.24', s => expect(s.text).toContain('Done · go to A2'))
    await check('W1.41', s => expect(s.text).toContain('Switch side'))
    await check('W1.9', s => expect(s.text).toContain('Every set done'))
    await check('W1.28', s => { expect(s.text).toContain('Save changes'); expect(s.host.querySelector('.g-wf-rest')).toBeNull() })
    await check('W1.29', s => expect(s.text).toContain('Offline · 6 waiting'))
    await check('W1.29b', s => { expect(s.text).toContain('Offline'); expect(s.text).not.toContain('waiting') })
    await check('W1.30', s => { expect(s.text).toContain('Pick as you go'); expect(s.text).toContain('Discard') })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useUI.getState().timer).toBeNull()
    expect(useUI.getState().work).toBeNull()
    expect(useStore.getState().S.active).toBe(own)
  }, 20000)
})

// Workout finish M2
describe('the screens gallery: Workout, start and finish', () => {
  it('has Ready, the drawers over it and the running workout, the toasts and the summary, all in memory', async () => {
    const ids = screenAreas().find(a => a.name === 'Workout: start and finish').entries.map(e => e.id)
    expect(ids).toEqual(['W1.1', 'W1.31', 'W1.40', 'W1.10', 'W1.11', 'W1.46', 'W1.26', 'W1.27', 'W2.0', 'W2.1', 'W2.2'])
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ host, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    const sheetTitle = s => s.drawer.querySelector('.g-bs-head h2').textContent
    await check('W1.1', s => {
      expect(s.host.querySelector('.g-ready-title').textContent).toBe('Push A')
      expect(s.host.querySelectorAll('.g-ready-gh')).toHaveLength(3)
      expect([...s.host.querySelectorAll('button')].some(b => b.textContent.trim() === 'Start workout')).toBe(true)
    })
    await check('W1.31', s => {
      expect(s.host.querySelector('.g-ready-title').textContent).toBe('Push A')
      expect(sheetTitle(s)).toBe('Start with your warm-up')
    })
    await check('W1.40', s => expect(sheetTitle(s)).toBe('Cool-down'))
    await check('W1.10', s => expect(sheetTitle(s)).toBe('Finish Push A?'))
    await check('W1.11', s => expect(sheetTitle(s)).toBe('Finish early?'))
    await check('W1.46', s => expect(sheetTitle(s)).toMatch(/^Discard \d+ sets?\?$/))
    await check('W1.26', s => {
      expect(s.host.querySelectorAll('.g-rc-slide')).toHaveLength(4)
      expect(s.host.textContent).toContain('Discarded Push A. The sets go unless you undo.')
    })
    await check('W1.27', s => expect(sheetTitle(s)).toBe('Push A is still open'))
    await check('W2.0', s => {
      expect(s.host.querySelector('h1').textContent).toBe('Push A, done')
      expect([...s.host.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).toEqual(expect.arrayContaining(['New bests', 'Muscles worked', 'What you just trained']))
      expect(s.host.textContent).not.toContain('Your first time')
    })
    await check('W2.1', s => {
      expect(s.host.querySelectorAll('.g-rc-slide')).toHaveLength(4)
      expect(s.host.textContent).toContain('Saved Push A')
    })
    await check('W2.2', s => {
      expect(s.host.textContent).toContain('Your first time')
      expect([...s.host.querySelectorAll('.g-ssec h2')].map(e => e.textContent)).not.toContain('New bests')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
    localStorage.removeItem('gym_state_v1')
  }, 30000)
})

// Workout drawers-M2
describe('the screens gallery: the workout\'s exercise drawers', () => {
  const IDS = ['W1.4', 'W1.12', 'W1.13', 'W1.14', 'W1.15', 'W1.16', 'W1.17', 'W1.25', 'W1.33', 'W1.34', 'W1.43']

  it('has every exercise drawer under its board id', () => {
    // The area is shared with drawers-M3's map and options states (below).
    expect(screenAreas().find(a => a.name === 'Workout: drawers').entries.map(e => e.id).filter(id => IDS.includes(id))).toEqual(IDS)
  })

  it('opens each drawer over the workout and leaves no rest, toast or session behind', async () => {
    const own = useStore.getState().S
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    await check('W1.4', s => { expect(s.drawer).toBeTruthy(); expect(s.text).toContain('Scroll to 0:00 to end the rest now.') })
    await check('W1.12', s => { expect(s.text).toContain('Set 1 ·'); expect(s.text).toContain('How hard was that set?'); expect(s.text).toContain('Save set 1') })
    await check('W1.13', s => expect(s.text).toContain('Set 3 gone.'))
    await check('W1.14', s => { expect(s.text).toContain('Exercise settings'); expect(s.text).toContain('Back to set') })
    await check('W1.15', s => { expect(s.text).toContain('Same muscle'); expect(s.text).toContain('Also in Push A') })
    await check('W1.16', s => expect(s.text).toMatch(/Swapped Cable middle fly for /i))
    await check('W1.17', s => expect(s.text).toMatch(/Removed Cable middle fly/i))
    await check('W1.25', s => { expect(s.text).toContain('Load 80 kg'); expect(s.text).toContain('Each side') })
    await check('W1.33', s => expect(s.text).toContain('First time with this one.'))
    await check('W1.34', s => expect(s.text).toContain('Best: '))
    await check('W1.43', s => expect(s.text).toContain('Held 2 × 30 s each side'))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useUI.getState().timer).toBeNull()
    expect(useStore.getState().S).toBe(own)
  }, 30000)
})

describe('the screens gallery: the workout\'s map, Add exercise and options', () => {
  const IDS = ['W1.37', 'W1.23', 'W1.45', 'W1.18', 'W1.19', 'W1.20', 'W1.21']

  it('has every state under its board id', () => {
    expect(screenAreas().find(a => a.name === 'Workout: drawers').entries.map(e => e.id).filter(id => IDS.includes(id))).toEqual(IDS)
  })

  it('opens each drawer over the workout and leaves no session or timer behind', async () => {
    const own = useStore.getState().S
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    await check('W1.37', s => { expect(s.text).toContain('Drag to reorder within a phase'); expect(s.text).toContain('Skip cool-down'); expect(s.text).toContain('Workout options') })
    await check('W1.23', s => expect(s.drawer).toBeTruthy())
    await check('W1.45', s => expect(s.text).toContain('20 exercises'))
    await check('W1.18', s => { expect(s.text).toContain('This workout'); expect(s.text).toContain('Add routine') })
    await check('W1.19', s => expect(s.text).toMatch(/Added .* · \d+ of 13/))
    await check('W1.20', s => { expect(s.text).toContain('Reorder exercises'); expect(s.text).toContain('Discard workout') })
    await check('W1.21', s => { expect(s.text).toContain('Next exercise on its own'); expect(s.text).toContain('Plate loading') })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useUI.getState().timer).toBeNull()
    expect(useStore.getState().S).toBe(own)
  }, 30000)
})

// Workout progression
describe('the screens gallery: Workout progression', () => {
  it('has W1.47 to W1.52 under their board ids, in the Workout areas', () => {
    const ids = name => screenAreas().find(a => a.name === name).entries.map(e => e.id)
    expect(ids('Workout').filter(id => ['W1.47', 'W1.49', 'W1.50', 'W1.51'].includes(id))).toEqual(['W1.47', 'W1.49', 'W1.50', 'W1.51'])
    expect(ids('Workout: drawers').filter(id => ['W1.48', 'W1.52'].includes(id))).toEqual(['W1.48', 'W1.52'])
  })

  it('shows the line, the dashed lines and the settings, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host, drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    await check('W1.47', s => {
      expect(s.host.querySelector('.g-prog-warning')).not.toBeNull()
      expect(s.text).toContain('Deload to 22 kg')
      expect(s.text).toContain('22 kg each')
    })
    await check('W1.49', s => {
      const line = s.host.querySelector('.g-prog')
      expect(line.textContent).toContain('Target goes up by 5s.')
      expect(s.host.querySelector('.g-xh').compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    await check('W1.50', s => { expect(s.host.querySelector('.g-prog')).toBeNull(); expect(s.host.querySelector('.g-nc-undo')).not.toBeNull() })
    await check('W1.51', s => { expect(s.text).toContain('The whole workout is left out of progression'); expect(s.host.querySelector('.g-wtop-status')).not.toBeNull() })
    await check('W1.48', s => { expect(s.text).toContain('Don’t count today'); expect(s.text).toContain('Today: ') })
    await check('W1.52', s => { expect(s.text).toContain('Weight means'); expect(s.text).toContain('Each') })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 30000)
})
