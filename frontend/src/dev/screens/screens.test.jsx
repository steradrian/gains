// @vitest-environment happy-dom
import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The gallery draws the Coach's own screens and the onboarding offer with the Coach on.
vi.mock('../../lib/coach-availability.js', () => ({ COACH_COMING_SOON: false }))
import { Stage } from './DevScreens.jsx'
import { allScreens, screenAreas, screenById } from './registry.js'
import { todayISO } from '../../lib/format.js'
import { _setMediaStore, createMediaStore, memoryBackend } from '../../lib/media-store.js'
import { useStore } from '../../store/useStore.js'
import { useUI } from '../../store/useUI.js'
import { useProfileWrites } from '../../lib/me/goal-writes.js'

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

  // Eat logging m1: the Log food steps (boards Ea8Search to Ea8Offline), over the Today screen.
  it('has the Log food steps, each over the Today screen and each at the step it names', async () => {
    const ids = screenAreas().find(a => a.name === 'Eat: Log food').entries.map(e => e.id)
    expect(ids).toEqual(['Ea8Search', 'Ea8FoodDetail', 'Ea8Food', 'Ea8Meal', 'Ea8Saved', 'Ea8SavedRecipes', 'Ea8NoMatch', 'Ea8Quick', 'Ea8Offline'])
    const check = async (id, test) => {
      const host = await show(screenById(id))
      // The pane on screen: the step's sub-panel when one is open, else the drawer's own results.
      test({ host, drawer: [...host.querySelectorAll('.g-bs-pane:not([inert])')].at(-1) ?? host.querySelector('.g-bs') })
      unmountAll()
    }
    for (const id of ids) await check(id, s => expect(s.host.querySelectorAll('.g-rc-slide'), id).toHaveLength(4))
    await check('Ea8Search', s => {
      expect(s.drawer.textContent).toContain('Greek yogurt 10%')
      expect(s.drawer.querySelector('.g-tag').textContent).toBe('OFF')
      expect(s.drawer.querySelector('button[aria-label="Add Greek yogurt 2% to Lunch"]')).not.toBeNull()
    })
    await check('Ea8FoodDetail', s => expect(s.drawer.textContent).toContain('After this, Lunch is'))
    await check('Ea8Food', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Food')
      expect(s.drawer.textContent).toContain('Per serving')
      expect(s.drawer.textContent).toContain('Save as food')
    })
    await check('Ea8Meal', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Logging to')
      expect(s.drawer.textContent).toContain('420 kcal logged')
      expect(s.drawer.textContent).toContain('Nothing yet')   // "Now, by the clock" marks the clock's meal only while it is empty
      expect(s.drawer.textContent).toContain('Your pick holds for the next half hour.')
    })
    await check('Ea8Saved', s => {
      expect(s.drawer.textContent).toContain('Saved meals · one tap logs all')
      expect(s.drawer.textContent).toContain('Office lunch')
    })
    await check('Ea8SavedRecipes', s => expect(s.drawer.textContent).toContain('Chili con carne'))
    await check('Ea8NoMatch', s => {
      expect(s.drawer.textContent).toContain('No match for “sarmalle cu mamaliga”')
      expect(s.drawer.textContent).toContain('Did you mean sarmale cu mamaliga')
      expect(s.drawer.textContent).toContain('Add calories only')
    })
    await check('Ea8Quick', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Quick calories')
      expect(s.drawer.textContent).toContain('stays out of My foods')
    })
    await check('Ea8Offline', s => {
      expect(s.drawer.textContent).toContain('Online results need a connection')
      expect(s.drawer.textContent).toContain('Greek yogurt 2%')
    })
  }, 30000)

  // Eat logging m2: a logged entry and the Scan overlay (boards Ea8Entry, Ea8Removed, Ea9*).
  it('has the logged entry and the Scan states, the camera a static placeholder', async () => {
    const ids = screenAreas().find(a => a.name === 'Eat: logged entry and Scan').entries.map(e => e.id)
    expect(ids).toEqual(['Ea8Entry', 'Ea8Removed', 'Ea9Scan', 'Ea9Looking', 'Ea9Found', 'Ea9NotFound', 'Ea9Denied', 'Ea9Type'])
    const getUserMedia = vi.fn()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ host, scan: host.querySelector('.g-scan'), drawer: host.querySelector('.g-bs') })
      unmountAll()
    }
    for (const id of ids) await check(id, s => expect(s.host.querySelectorAll('.g-rc-slide'), id).toHaveLength(4))
    await check('Ea8Entry', s => {
      expect(s.drawer.classList.contains('g-bs-half')).toBe(true)
      expect(s.drawer.querySelector('h2').textContent).toBe('Logged food')
      expect(s.drawer.querySelector('.g-en-name').textContent).toBe('Banana')
      expect(s.drawer.querySelector('.g-en-sub').textContent).toMatch(/^Snacks · logged \d\d:\d\d · 105 kcal$/)
      expect(s.drawer.querySelector('button[aria-label="Remove Banana from Snacks"]')).not.toBeNull()
    })
    await check('Ea8Removed', s => expect(s.host.ownerDocument.body.textContent).toContain('Removed Banana from Today, Snacks'))
    await check('Ea9Scan', s => {
      expect(s.scan.querySelector('h2').textContent).toBe('Scan a barcode')
      expect(s.scan.textContent).toContain('Point the camera at the barcode')
      expect(s.scan.querySelector('video')).toBeNull()
    })
    await check('Ea9Looking', s => {
      expect(s.scan.textContent).toContain('5 201054 012345')
      expect(s.scan.textContent).toContain('Looking in your foods, then Open Food Facts')
    })
    await check('Ea9Found', s => {
      expect(s.scan.querySelector('.g-scan-card').textContent).toContain('Greek yogurt 10%')
      expect(s.scan.textContent).toContain('Log to Lunch')
      expect(s.scan.textContent).toContain('Save food')
    })
    await check('Ea9NotFound', s => {
      expect(s.scan.querySelector('.g-scan-card h2').textContent).toBe('Not in Open Food Facts yet')
      expect(s.scan.textContent).toContain('Create food with this barcode')
    })
    await check('Ea9Denied', s => {
      expect(s.scan.textContent).toContain('Camera is blocked')
      expect(s.scan.textContent).toContain('Try again')
    })
    await check('Ea9Type', s => {
      expect(s.drawer.querySelector('h2').textContent).toBe('Type the barcode')
      expect(s.drawer.querySelector('.g-bs-foot button').disabled).toBe(false)
    })
    expect(getUserMedia).not.toHaveBeenCalled()
    Reflect.deleteProperty(navigator, 'mediaDevices')
  }, 30000)

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

  it('Units in the gallery converts nothing real: setUnit and resetDemo never reach this browser’s saved copy', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const realSetUnit = useStore.getState().setUnit
    const realResetDemo = useStore.getState().resetDemo
    const seen = {}
    const entry = {
      ...screenById('A1.5'),
      play: async () => {
        useStore.getState().setUnit('lb')
        await useStore.getState().resetDemo()
        await new Promise(resolve => setTimeout(resolve, 20))
        seen.unit = useStore.getState().S.unit
        seen.saved = localStorage.getItem('gym_state_v1')
      },
    }
    try {
      await show(entry)
      expect(seen).toEqual({ unit: 'lb', saved: '{"real":true}' })
      unmountAll()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
      expect(useStore.getState().setUnit).toBe(realSetUnit)
      expect(useStore.getState().resetDemo).toBe(realResetDemo)
      expect(useStore.getState().S.unit).not.toBe('lb')
    } finally {
      localStorage.removeItem('gym_state_v1')
    }
  }, 10000)

  it('a Start over confirmed in the mocked Account page leaves this browser’s profile, media and storage alone', async () => {
    const own = createMediaStore(memoryBackend())
    await own.put('real-photo', new Blob(['x'], { type: 'image/jpeg' }), { mime: 'image/jpeg', pending: false })
    _setMediaStore(own)
    localStorage.setItem('gallery-test-marker', 'keep')
    const resetEverything = vi.fn()
    useStore.setState({ resetEverything })
    await new Promise(resolve => setTimeout(resolve, 20))

    const entry = {
      ...screenById('A2.0'),
      play: async t0 => {
        await t0.wait(250)
        const row = [...document.querySelectorAll('.g-danger-row')].find(r => r.querySelector('b')?.textContent === 'Start over')
        if (!row) throw new Error('Start over row not found')
        row.click()
        await t0.click('Start over')
        await t0.wait(400)
      },
    }
    try {
      await show(entry)
      unmountAll()
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(resetEverything).not.toHaveBeenCalled()
      expect((await own.list()).map(r => r.hash)).toEqual(['real-photo'])
      expect(localStorage.getItem('gallery-test-marker')).toBe('keep')
      expect(useStore.getState().resetEverything).toBe(resetEverything)
    } finally {
      localStorage.removeItem('gallery-test-marker')
      _setMediaStore(null)
    }
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
      // The first time shows no Next time; the bests its record carries still show.
      expect(s.host.textContent).toContain('Your first time')
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

describe('the screens gallery: Me > Body', () => {
  it('has M2.0 to M2.4 and the edge states under their board ids, in Me: body', () => {
    const ids = screenAreas().find(a => a.name === 'Me: body').entries.map(e => e.id)
    expect(ids).toEqual(expect.arrayContaining(['M2.0', 'M2.1', 'M2.2', 'M2.3', 'M2.4']))
    expect(ids.filter(id => !id.startsWith('M2.5') && !id.startsWith('M2.6') && id !== 'M2.7'))
      .toEqual(['M2.0', 'M2.0a', 'M2.0b', 'M2.0c', 'M2.0d', 'M2.0e', 'M2.1', 'M2.1a', 'M2.1b', 'M2.2', 'M2.3', 'M2.4', 'M2.4a'])
  })

  it('shows the page, its drawers, the held toast and the empty states, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const footer = h => h.querySelector('.g-snote').textContent
    await check('M2.0', h => {
      expect(h.querySelector('.g-spage-title').textContent).toBe('Body')
      expect(h.querySelector('.g-spage-sub').textContent).toContain('81.4 kg today · −0.3 kg in 7 days')
      expect(h.querySelectorAll('.g-grow')).toHaveLength(7)
      expect(h.querySelector('.g-ssec-act').textContent).toBe('7 shown')
      expect(h.querySelector('.g-tc-cap').textContent).toBe('Target 78 kg')
      expect(footer(h)).toContain('Gains also asks for a weigh-in before your first workout of the week.')
    })
    await check('M2.0c', h => {
      expect(footer(h)).toBe('Same time, before breakfast, gives the cleanest trend.')
    })
    await check('M2.0e', h => {
      expect(h.querySelector('.g-saved-offline').textContent).toContain('1 change waiting')
      expect(h.querySelectorAll('.g-wir-tags .g-tag')).toHaveLength(7)
      expect(h.textContent).toContain('Waiting to sync')
    })
    await check('M2.1a', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Log weight')
      expect(h.querySelector('.g-wi-again').textContent).toContain('You weighed in today at 81.4 kg. Saving replaces it; Undo follows.')
    })
    await check('M2.1b', h => expect(h.querySelector('.g-wi-far').textContent).toContain('10.2 kg from your last weigh-in'))
    await check('M2.2', h => {
      const drawer = h.querySelector('.g-bs')
      expect(drawer.querySelector('h2').textContent).toBe('Edit weigh-in')
      expect(drawer.textContent).toContain('Logged ')
      expect([...drawer.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Save weigh-in', 'Delete weigh-in'])
    })
    await check('M2.3', h => {
      expect(h.querySelector('.g-utoast-msg').textContent).toMatch(/^Deleted 81\.7 kg from /)
      expect(h.querySelector('.g-ssec-act').textContent).toBe('6 shown')
      expect(h.querySelector('.g-bs')).toBeNull()
    })
    await check('M2.4', h => {
      expect(h.querySelector('.g-sempty').className).not.toContain('g-sempty-card')
      expect(h.querySelector('.g-sempty').textContent).toContain('No weigh-ins yet')
      expect(h.querySelector('.g-sempty').textContent).toContain('Gains also asks before your first workout of the week.')
      expect(h.querySelector('.g-spage-sub').textContent).toBe('Nothing logged yet')
    })
    await check('M2.4a', h => expect(h.querySelector('.g-sempty').textContent).not.toContain('Gains also asks'))
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 30000)
})

// Me changes M3
describe('the screens gallery: Me, recent changes', () => {
  it('has M4.0 to M4.2 under their board ids, in Me: changes', () => {
    const ids = screenAreas().find(a => a.name === 'Me: changes').entries.map(e => e.id)
    expect(ids).toEqual(expect.arrayContaining(['M4.0', 'M4.1', 'M4.2', 'M4.1s', 'M4.1x', 'M4.1o', 'M4.0k']))
  })

  it('shows the rows, the held toast, Snacks, a refusal and the empty scene, and writes nothing real', async () => {
    localStorage.setItem('gains_recent_changes:guest', '[]')
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('M4.0', s => {
      expect(s.text).toContain('Recent changes')
      expect(s.text).toContain('Deleted Oats with milk')
      expect(s.text).toContain('Coach moved Legs')
      expect(s.host.querySelectorAll('.g-grow')).toHaveLength(5)
    })
    await check('M4.1', s => {
      expect(s.host.querySelector('.g-tag').textContent).toBe('Restored')
      expect(useUI.getState().toastMsg).toMatch(/^Restored Oats with milk to .+, Breakfast$/)
    })
    await check('M4.1s', () => expect(useUI.getState().toastMsg).toMatch(/Snacks\. Breakfast was deleted\.$/))
    await check('M4.1x', () => expect(useUI.getState().toastMsg).toContain('that day already has a weigh-in'))
    await check('M4.1o', () => expect(useUI.getState().toastMsg).toContain('Check your connection'))
    await check('M4.2', s => {
      expect(s.text).toContain('Nothing in the last 7 days')
      expect(s.host.querySelector('.g-sempty button')).toBeNull()
    })
    await check('M4.0k', s => {
      expect(s.text).toContain('Target weight changed to 77 kg')
      expect(s.text).toContain('Deleted workout Pull A')
      expect(s.text).toContain('Deleted a weigh-in')
    })
    expect(localStorage.getItem('gains_recent_changes:guest')).toBe('[]')
  }, 30000)
})

// Me photos M2
describe('the screens gallery: Me > Photos', () => {
  it('has M2.8, M2.9, M2.12 and M2.13 and the edge states under their board ids, in Me: photos', () => {
    const ids = screenAreas().find(a => a.name === 'Me: photos').entries.map(e => e.id).filter(id => !/^M2\.1[01]/.test(id))
    expect(ids).toEqual(['M2.8', 'M2.8a', 'M2.8b', 'M2.8c', 'M2.8d', 'M2.8e', 'M2.9', 'M2.12', 'M2.13'])
  })

  it('shows the tab, the drawer, the held toast and the empty state, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('M2.8', h => {
      expect(h.querySelector('.g-spage-title').textContent).toBe('Body')
      expect(h.querySelector('.g-spage-sub').textContent).toMatch(/^6 photos on this phone · since /)
      expect(h.querySelectorAll('.g-ptile')).toHaveLength(6)
      expect(h.querySelector('.g-ptile-cap').textContent).toBe('81.4 kg')
      expect(h.querySelector('.g-ssec h2').textContent).toBe('On this phone')
      expect(h.querySelector('.g-snote').textContent).toBe('Stored on this phone only. Only you see them; Friends never do.')
      expect(h.textContent).not.toMatch(/encrypt/i)
    })
    await check('M2.8a', h => {
      expect(h.querySelector('.g-spage-sub').textContent).toBe('6 photos · backed up')
      expect(h.querySelector('.g-ssec h2').textContent).toBe('In your account')
      expect(h.querySelector('.g-snote').textContent).toContain('Backed up to your account.')
    })
    await check('M2.8b', h => {
      expect([...h.querySelectorAll('button')].find(b => b.textContent === 'Compare').disabled).toBe(true)
      expect(h.querySelector('.ph-line').textContent).toBe('Add one more photo to compare.')
    })
    await check('M2.8c', h => expect(h.querySelectorAll('.g-ptile-gone')).toHaveLength(1))
    await check('M2.8d', h => expect(h.querySelector('.g-ptile-cap').textContent).toBe('179.5 lb'))
    await check('M2.8e', h => expect(h.querySelector('.g-ptile-cap')).toBeNull())
    await check('M2.9', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Add photo')
      expect(h.querySelector('.g-bs-chip').textContent).toBe('Today')
      expect(h.querySelector('.g-bs').textContent).toContain('Choose from library')
    })
    await check('M2.12', h => {
      expect(h.querySelector('.g-sempty').className).not.toContain('g-sempty-card')
      expect(h.querySelector('.g-sempty b').textContent).toBe('No photos yet')
      expect(h.querySelector('.g-spage-sub')).toBeNull()
    })
    await check('M2.13', h => {
      expect(h.querySelector('.g-utoast-msg').textContent).toBe('Backing up 6 photos to your account')
      expect(h.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
      expect(h.querySelector('.g-snote').textContent).toContain('Backed up to your account.')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 30000)
})

// Me photos M3
describe('the screens gallery: Me > Photos > viewer and Compare', () => {
  it('has M2.10 and M2.11 and their edge states under their board ids, in Me: photos', () => {
    const ids = screenAreas().find(a => a.name === 'Me: photos').entries.map(e => e.id).filter(id => /^M2\.1[01]/.test(id))
    expect(ids).toEqual(['M2.10', 'M2.10a', 'M2.10b', 'M2.10c', 'M2.11', 'M2.11a', 'M2.11b'])
  })

  it('shows the viewer, its delete confirm, Compare and its picker, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll(); useUI.getState().closeAll() }
    await check('M2.10', h => {
      expect(h.querySelector('.g-pstage-count').textContent).toBe('3 of 6')
      expect(h.querySelector('.g-pstage-pic img')).not.toBeNull()
      expect(h.querySelector('.g-pstage-cap span').textContent).toBe('83 kg that day')
      expect([...h.querySelectorAll('.g-pstage-acts button')].map(b => b.textContent)).toEqual(['Compare', 'Delete'])
    })
    await check('M2.10a', h => {
      expect(h.querySelector('.g-pstage-count').textContent).toBe('6 of 6')
      expect(h.querySelector('.g-pstage-nav-next')).toBeNull()
    })
    await check('M2.10b', h => expect(h.querySelector('.g-pstage-count').textContent).toMatch(/ of 6$/))
    await check('M2.10c', h => {
      expect(h.textContent).toContain('Delete this photo?')
      expect(h.querySelector('.g-confirm').textContent).toContain('This photo goes from your photos.')
    })
    await check('M2.11', h => {
      expect(h.querySelector('.g-cmp-line').textContent).toBe('77 days apart · -3.6 kg · waist -4 cm')
      expect(h.querySelectorAll('.g-cmp-side')).toHaveLength(2)
    })
    await check('M2.11a', h => expect(h.querySelector('.g-cmp-line').textContent).toBe('77 days apart'))
    await check('M2.11b', h => {
      expect(h.querySelector('.g-pstage-title').textContent).toBe('Choose the before photo')
      expect(h.querySelectorAll('.g-pstage .g-ptile')).toHaveLength(5)
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 30000)
})

// Me body M2
describe('the screens gallery: Me > Body > Measurements', () => {
  it('has M2.5 to M2.7 and the edge states under their board ids, in Me: body', () => {
    const ids = screenAreas().find(a => a.name === 'Me: body').entries.map(e => e.id)
    expect(ids.filter(id => id.startsWith('M2.5') || id.startsWith('M2.6') || id === 'M2.7'))
      .toEqual(['M2.5', 'M2.5a', 'M2.5b', 'M2.5c', 'M2.6', 'M2.6a', 'M2.6b', 'M2.7'])
  })

  it('shows the tab, both drawers, the sub-panel and the empty states, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('M2.5', h => {
      expect(h.querySelector('.g-spage-sub').textContent).toMatch(/^5 tracked · last on /)
      expect([...h.querySelectorAll('.g-cchip')].map(c => c.textContent)).toEqual(['Chest', 'Waist', 'Hips', 'Left upper arm', 'Right thigh'])
      expect(h.querySelector('.bd-eyebrow').textContent).toMatch(/^Waist · /)
      expect(h.querySelector('.bd-big').textContent).toBe('84cm')
      expect(h.querySelector('.bd-lines').textContent).toContain('−1.5 cm since previous')
      expect(h.querySelector('.bd-lines').textContent).toMatch(/−4 cm since /)
      expect(h.querySelectorAll('.g-gvr')).toHaveLength(5)
      expect(h.querySelector('.g-tc-target')).toBeNull()
    })
    await check('M2.5a', h => {
      expect(h.querySelector('.g-sempty').className).not.toContain('g-sempty-card')
      expect(h.querySelector('.g-sempty').textContent).toContain('Nothing to chart yet')
      expect(h.querySelector('.g-spage-sub').textContent).toBe('Nothing tracked yet')
    })
    await check('M2.5b', h => expect(h.querySelector('.g-sempty').textContent).toContain('No measurements yet'))
    await check('M2.5c', h => expect(h.querySelector('.bd-big').textContent).toBe('33.1in'))
    await check('M2.6', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Log measurements')
      expect(h.querySelector('.g-bs-chip').textContent).toBe('Today')
      expect(h.querySelectorAll('.g-bs .g-tfield')).toHaveLength(5)
      const waist = [...h.querySelectorAll('.g-bs .g-tfield')].find(f => f.querySelector('.g-tfield-label').textContent === 'Waist')
      expect(waist.querySelector('input').value).toBe('83.5')
      expect(waist.querySelector('.g-tfield-unit').textContent).toBe('cm')
      expect(h.querySelector('.g-bs-foot button').textContent).toBe('Save measurements')
    })
    await check('M2.6a', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Edit measurements')
      expect(h.querySelector('.g-utoast-msg').textContent).toBe('That date already has measurements. Edit it instead.')
    })
    await check('M2.6b', h => {
      expect(h.querySelector('.g-bs-pane[data-pos="active"] h2').textContent).toBe('Choose measurements')
      expect(h.querySelectorAll('.g-bs')).toHaveLength(1)
    })
    await check('M2.7', h => {
      const pane = h.querySelector('.g-bs-pane[data-pos="active"]')
      expect(pane.querySelector('h2').textContent).toBe('Choose measurements')
      expect([...pane.querySelectorAll('.bd-group-title')].map(g => g.textContent)).toEqual(['Torso', 'Arms', 'Legs', 'Other', 'Your own'])
      expect(pane.querySelectorAll('[role="switch"]')).toHaveLength(19)
      expect(pane.querySelectorAll('[role="switch"][aria-checked="true"]')).toHaveLength(5)
      expect(h.querySelectorAll('.g-bs')).toHaveLength(1)
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 30000)
})

// Me invite M2
describe('the screens gallery: Me > Invite a friend', () => {
  it('has M5.0 to M5.3 under their board ids, in Me: invite', () => {
    const ids = screenAreas().find(a => a.name === 'Me: invite').entries.map(e => e.id)
    expect(ids).toEqual(expect.arrayContaining(['M5.0', 'M5.1', 'M5.2', 'M5.3', 'M5.0a', 'M5.0m', 'M5.0r', 'M5.0o', 'M5.0l', 'M5.1u']))
  })

  it('shows the list, the drawer, the held toast, the error, the asks, the menu and its confirm, and persists nothing', async () => {
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('M5.0', s => {
      expect(s.text).toContain('Bring a friend in')
      expect(s.text).toContain('lasts 7 days')
      expect(s.host.querySelectorAll('.g-grow')).toHaveLength(5)
    })
    await check('M5.1', s => {
      expect(s.host.querySelector('.g-bs h2').textContent).toBe('New invite')
      expect([...s.host.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Create and copy link', 'Create and share'])
    })
    await check('M5.2', s => {
      expect(s.host.querySelector('.inv-group .g-grow b').textContent).toBe('Andrei')
      expect(useUI.getState().toastMsg).toBe('Invite for Andrei created and link copied')
      expect(useUI.getState().toastAction.label).toBe('Revoke')
    })
    await check('M5.2c', () => expect(useUI.getState().toastMsg).toBe('Invite created. Copy its invite link from the list.'))
    await check('M5.1e', s => expect(s.host.querySelector('.g-bs [role="alert"]').textContent).toContain('Too many invites'))
    await check('M5.1n', s => expect(s.host.querySelector('.g-bs input').value).toBe('Vlad'))
    await check('M5.1u', s => expect([...s.host.querySelectorAll('.g-bs-foot button')].map(b => b.textContent)).toEqual(['Create and copy link']))
    await check('M5.3', s => {
      expect(s.text).toContain('Couldn’t load invites')
      expect(s.host.querySelector('.g-sempty button').textContent).toBe('Try again')
    })
    await check('M5.3r', s => {
      expect(s.host.querySelector('.g-sempty')).toBeNull()
      expect(s.text).toContain('Mara')
    })
    await check('M5.0a', s => expect([...s.host.querySelectorAll('.g-ssec h2')].map(h => h.textContent)[0]).toBe('Asked'))
    await check('M5.0q', s => expect(s.host.querySelector('.g-bs .inv-ask').textContent).toContain('Dana'))
    await check('M5.0m', s => expect([...s.host.querySelectorAll('.g-menuitem')].map(b => b.textContent)).toEqual(['Copy link', 'Share link', 'Revoke']))
    await check('M5.0r', s => {
      expect(s.host.querySelector('.g-bs-pane[data-pos="active"] h2').textContent).toBe('Revoke this invite?')
      expect(s.host.querySelectorAll('.g-bs')).toHaveLength(1)
    })
    await check('M5.0o', s => expect(s.text).toContain('Sign-up is open'))
    await check('M5.0l', s => expect(s.host.querySelectorAll('.inv-sk')).toHaveLength(3))
    await check('M5.0e', s => expect(s.host.querySelector('.g-ssec')).toBeNull())
    await check('M5.0k', s => expect(s.text).toContain('Invite E5F6…'))
  }, 60000)
})

// Me goal M2
describe('the screens gallery: Me > My goal', () => {
  it('has M3.0 to M3.4 and M3.7 and the edge states under their board ids, in Me: goal', () => {
    const ids = screenAreas().find(a => a.name === 'Me: goal').entries.map(e => e.id).filter(id => !/^M3\.[56]/.test(id))
    expect(ids).toEqual([
      'M3.0', 'M3.0r', 'M3.0w', 'M3.0n', 'M3.0e', 'M3.0l', 'M3.0p', 'M3.0x', 'M3.1', 'M3.1e', 'M3.2', 'M3.3', 'M3.3g', 'M3.3w', 'M3.3p', 'M3.3s', 'M3.4', 'M3.4g', 'M3.7',
    ])
  })

  it('shows the page, the four drawers, the gated pair, the saved toast and the edge states, and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const live = useProfileWrites.getState().live
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const ring = h => h.querySelector('.g-sring').getAttribute('aria-label')
    const values = h => Object.fromEntries([...h.querySelectorAll('.g-gvr')].map(r => [r.querySelector('b').textContent, r.querySelector('.g-gvr-val')?.textContent ?? null]))
    await check('M3.0', h => {
      expect(h.querySelector('.g-spage-sub').textContent).toBe('Lose weight · 78 kg · 2,100 kcal a day')
      expect(ring(h)).toBe('Target weight 78.0 kg · 3.4 kg to go')
      expect(h.querySelector('.mg-started').textContent).toMatch(/^Started at 85\.0 kg on /)
      expect(h.querySelectorAll('.g-gvr')).toHaveLength(12)
      expect(values(h)).toMatchObject({ Goal: 'Lose weight', 'Target weight': '78.0 kg', Height: '182 cm', Sex: 'Male', Calories: '2,100 kcal', Water: '2,500 ml' })
      expect(h.querySelector('.g-btn')).toBeNull()
    })
    await check('M3.0r', h => {
      expect(ring(h)).toBe('Target weight 78.0 kg · Target reached')
      expect(h.querySelector('.g-btn').textContent).toBe('Keep my weight')
    })
    await check('M3.0w', h => {
      expect(ring(h)).toBe('Target weight 78.0 kg · Log your first weigh-in')
      expect(h.querySelector('.mg-started')).toBeNull()
    })
    await check('M3.0n', h => {
      expect(Object.keys(values(h))).toEqual(['Target weight'])
    })
    await check('M3.0e', h => {
      expect(h.querySelector('.g-sempty b').textContent).toBe('Goals did not load.')
      expect(h.querySelector('.g-sempty').className).not.toContain('g-sempty-card')
    })
    await check('M3.0l', h => expect(h.querySelector('[aria-busy="true"]')).toBeTruthy())
    await check('M3.0p', h => expect(values(h)).toMatchObject({ Height: '6 ft 0 in', 'Target weight': '172.0 lb' }))
    await check('M3.0x', h => expect(values(h)).toMatchObject({ Goal: 'Add', Height: 'Add', 'Birth year': 'Add', 'Daily movement': 'Add', Calories: 'Not set' }))
    await check('M3.1', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Goal')
      expect([...h.querySelectorAll('.g-bs [role="radio"]')].map(r => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    })
    await check('M3.1e', h => {
      expect(h.querySelector('.g-bs [role="alert"]').textContent).toBe('Check your connection and try again.')
      expect(h.querySelectorAll('.g-bs')).toHaveLength(1)
    })
    await check('M3.2', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Target weight')
      expect(h.querySelector('.g-bs input').value).toBe('78.0')
      expect(h.querySelector('.g-bs .g-tfield-hint').textContent).toMatch(/^3\.4 kg to go from 81\.4 kg\./)
      expect(h.querySelector('.g-bs-foot .g-btn').textContent).toBe('Save target weight')
    })
    await check('M3.3', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Body details')
      expect([...h.querySelectorAll('.g-bs input')].map(i => i.value)).toEqual(['182', '1994'])
      expect(h.querySelector('.g-bs-foot .g-btn').textContent).toBe('Save body details')
    })
    await check('M3.3g', h => {
      expect(h.querySelector('.g-bs input')).toBeNull()
      expect(h.querySelector('.g-bs-foot')).toBeNull()
      expect(h.querySelector('.g-bs .mg-foot').textContent).toBe('Changing this arrives soon')
    })
    await check('M3.3w', h => {
      expect(h.querySelector('.g-bs').textContent).toContain('Your burn estimate needs a weigh-in.')
      expect([...h.querySelectorAll('.g-bs button')].some(b => b.textContent === 'Log weight')).toBe(true)
    })
    await check('M3.3p', h => expect([...h.querySelectorAll('.g-bs input')].map(i => i.value)).toEqual(['6', '0', '1994']))
    await check('M3.3s', h => expect(h.querySelector('.g-bs .g-seg [aria-pressed="true"]').textContent).toBe('Prefer not to say'))
    await check('M3.4', h => {
      expect(h.querySelector('.g-bs h2').textContent).toBe('Daily movement')
      expect([...h.querySelectorAll('.g-bs [role="radio"]')].map(r => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false'])
    })
    await check('M3.4g', h => {
      expect(h.querySelector('.g-bs [role="radio"]')).toBeNull()
      expect(h.querySelector('.g-bs').textContent).toContain('Changing this arrives soon')
    })
    await check('M3.7', h => {
      expect(values(h)['Target weight']).toBe('77.0 kg')
      expect(useUI.getState().toastMsg).toBe('Target weight changed to 77.0 kg')
      expect(useUI.getState().toastAction.label).toBe('Undo')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(useProfileWrites.getState().live).toBe(live)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
    expect(Object.keys(localStorage).filter(k => k.startsWith('gains_recent_changes') && k.includes('u1'))).toEqual([])
  }, 60000)
})

// Me invite M3
describe('the screens gallery: Me > Invite a friend, the member\'s view', () => {
  it('has M5.4 and M5.5 and the edge states in Me: invite', () => {
    const ids = screenAreas().find(a => a.name === 'Me: invite').entries.map(e => e.id)
    expect(ids).toEqual(expect.arrayContaining(['M5.4', 'M5.5', 'M5.5u', 'M5.4o', 'M5.4x', 'M5.4c', 'M5.4d', 'M5.4q', 'M5.4f', 'M5.4g', 'M5.0n']))
  })

  it('shows the ask, the held toast, the open asks, the cap, the refusals, Groups and the guest redirect', async () => {
    const check = async (id, test) => {
      const host = await show(screenById(id))
      test({ text: host.textContent, host })
      unmountAll()
    }
    await check('M5.4', s => {
      expect(s.text).toContain('Only admins invite people to Gains')
      expect([...s.host.querySelectorAll('button')].find(b => b.textContent === 'Ask an admin').disabled).toBe(true)
    })
    await check('M5.4w', s => expect([...s.host.querySelectorAll('button')].find(b => b.textContent === 'Ask an admin').disabled).toBe(false))
    await check('M5.5', s => {
      expect(useUI.getState().toastMsg).toBe('Asked an admin. You’ll hear when the invite is sent.')
      expect(useUI.getState().toastAction.label).toBe('Undo')
      expect(s.host.querySelector('input').value).toBe('')
      expect(s.text).toContain('My training partner Andrei')
    })
    await check('M5.5u', s => expect(s.host.querySelector('.g-ssec')).toBeNull())
    await check('M5.4o', s => expect(s.text).toContain('My training partner Andrei'))
    await check('M5.4x', s => expect(s.host.querySelector('.g-ssec')).toBeNull())
    await check('M5.4c', s => expect(s.text).toContain('You have 3 open asks. Withdraw one to ask again.'))
    await check('M5.4d', s => expect(s.host.querySelector('[role="alert"]').textContent).toBe('You’ve asked 3 times today. Try again in 4h 0m.'))
    await check('M5.4q', s => expect(s.host.querySelector('[role="alert"]').textContent).toBe('You have 3 open asks. Withdraw one to ask again.'))
    await check('M5.4f', s => expect(s.host.querySelector('[role="alert"]').textContent).toContain('Check your connection'))
    await check('M5.4g', s => expect(s.text).toContain('Already on Gains? Add them to a group from Friends instead'))
    await check('M5.0n', s => expect(s.text).toContain('Redirected to the Me root'))
  }, 60000)
})

// Me root M2
describe('the screens gallery: Me root', () => {
  it('has M1.0 to M1.2 and the edge states under their board ids, in Me', () => {
    const ids = screenAreas().find(a => a.name === 'Me').entries.map(e => e.id)
    expect(ids).toEqual(expect.arrayContaining(['M1.0', 'M1.1', 'M1.2', 'M1.0t', 'M1.0n', 'M1.0f', 'M1.0x', 'M1.0l', 'M1.0m', 'M1.0s']))
  })

  it('shows the full root, the new account, the Groups slot, target reached, no target, food off and no NutriTrace', async () => {
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    await check('M1.0', host => {
      expect(host.textContent).toContain('81.4')
      expect(host.textContent).toContain('3.4 kg to 78')
      expect(host.textContent).toContain('4 of 6')
      expect(host.textContent).toContain('2 joined · 1 waiting')
      expect(host.querySelector('.g-mcard')).not.toBeNull()
    })
    await check('M1.1', host => {
      expect(host.textContent).toContain('Log your first weigh-in')
      expect(host.textContent).toContain('Set your target weight')
      expect(host.querySelector('.g-mcard')).toBeNull()
    })
    await check('M1.2', host => {
      const rows = [...host.querySelectorAll('.g-glist-row')]
      expect(rows.at(-1).querySelector('b').textContent).toBe('Groups')
      expect(rows.at(-1).querySelector('.g-tag').textContent).toBe('New')
    })
    await check('M1.0t', host => {
      expect(host.textContent).toContain('Target reached')
      expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Keep my weight')).toBe(true)
    })
    await check('M1.0n', host => expect(host.textContent).toContain('Set a target weight'))
    await check('M1.0f', host => expect(host.querySelectorAll('.g-rc-slide')).toHaveLength(2))
    await check('M1.0x', host => {
      expect(host.textContent).toContain('78 kg target')
      expect(host.textContent).not.toContain('kcal a day')
    })
    await check('M1.0l', host => expect(host.querySelector('.me-goal-sk')).not.toBeNull())
    await check('M1.0s', host => expect([...host.querySelectorAll('.g-gact')].map(b => b.textContent)).toEqual(['Log weight', 'Measure', 'Photo']))
  }, 60000)
})

// Me goal M3
describe('the screens gallery: Me > Daily targets and How this is worked out', () => {
  it('has M3.5 and M3.6 and their edge states, in Me: goal', () => {
    const ids = screenAreas().find(a => a.name === 'Me: goal').entries.map(e => e.id).filter(id => /^M3\.[56]/.test(id))
    expect(ids).toEqual(['M3.5', 'M3.5m', 'M3.5l', 'M3.5d', 'M3.5w', 'M3.5g', 'M3.6', 'M3.6a', 'M3.6r', 'M3.6e', 'M3.6d', 'M3.6n', 'M3.6t'])
  })

  it('shows each state it names and writes nothing real', async () => {
    localStorage.setItem('gym_state_v1', '{"real":true}')
    const own = useStore.getState().S
    const check = async (id, test) => { test(await show(screenById(id))); unmountAll() }
    const title = h => h.querySelector('.g-bs h2').textContent
    const fields = h => [...h.querySelectorAll('.g-bs .g-tfield')].map(f => [f.querySelector('.g-tfield-label').textContent, f.querySelector('input').value])
    const banner = h => h.querySelector('.g-bs .g-ibanner')?.textContent ?? null
    await check('M3.5', h => {
      expect(title(h)).toBe('Daily targets')
      expect(fields(h)).toEqual([['Calories', '2100'], ['Protein', '150'], ['Carbs', '230'], ['Fat', '70'], ['Water', '2500']])
      expect(h.querySelector('.g-bs .g-seg [aria-pressed="true"]').textContent).toBe('Fixed')
      expect(banner(h)).toBeNull()
      expect(h.querySelector('.g-bs-foot .g-btn').textContent).toBe('Save daily targets')
    })
    await check('M3.5m', h => {
      expect(banner(h)).toContain('The macros add up to 1,630 kcal, the calorie target is 2,100 kcal.')
      expect(banner(h)).toContain('Set carbs to 218 g')
    })
    await check('M3.5l', h => expect(banner(h)).toContain('Most guidelines suggest at least 1,200 kcal.'))
    await check('M3.5d', h => {
      expect(h.querySelector('.g-bs .g-seg [aria-pressed="true"]').textContent).toBe('Fixed')
      expect(h.querySelector('.g-bs .mg-foot').textContent).toContain('Dynamic needs a connected wearable.')
    })
    await check('M3.5w', h => {
      expect(fields(h).map(f => f[0])).toEqual(['Calories', 'Protein', 'Carbs', 'Water'])
      expect(h.querySelector('.g-bs').textContent).toContain('Varies by weekday')
    })
    await check('M3.5g', h => {
      expect(h.querySelectorAll('.g-bs-pane')).toHaveLength(2)
      expect(h.querySelector('.g-bs-pane[data-pos="active"] h2').textContent).toBe('Discard changes?')
      expect(h.querySelector('.g-bs-pane[data-pos="active"]').textContent).toContain('Keep editing')
    })
    await check('M3.6', h => {
      expect(title(h)).toBe('How this is worked out')
      expect([...h.querySelectorAll('.g-bs .mg-figs dt')].map(d => d.textContent)).toEqual(['Your burn', 'Goal factor', 'Target'])
      // The board's man stores 2,100 kcal; his goal works out to a little less, so the drawer says what his targets are set to.
      expect(h.querySelectorAll('.g-bs .mg-para')).toHaveLength(5)
      expect(h.querySelector('.g-bs').textContent).toContain('Your Daily targets are set to 2,100 kcal a day.')
      expect(h.querySelector('.g-bs-foot .g-btn').textContent).toBe('Edit daily targets')
    })
    await check('M3.6a', h => expect(h.querySelector('.g-bs .mg-adapt-head').textContent).toBe('Adaptive is learning12 of 21 so far'))
    await check('M3.6r', h => {
      expect(h.querySelector('.g-bs .mg-adapt-head').textContent).toBe('Adaptive is readyEstimated burn 2,650 kcal a day')
      expect(h.querySelector('.g-bs .g-tag')).toBeNull()
    })
    await check('M3.6e', h => {
      expect(h.querySelector('.g-bs .g-tag').textContent).toBe('Early')
      expect(h.querySelector('.g-bs .mg-adapt').textContent).toContain('Firms up at 35 days')
    })
    await check('M3.6d', h => expect(h.querySelector('.g-bs').textContent).toContain('Your target follows your burn, workouts included.'))
    await check('M3.6n', h => {
      expect(h.querySelector('.g-bs .mg-figs')).toBeNull()
      expect([...h.querySelectorAll('.g-bs button')].some(b => b.textContent === 'Body details')).toBe(true)
    })
    await check('M3.6t', h => {
      expect(h.querySelectorAll('.g-bs-pane')).toHaveLength(2)
      expect(h.querySelector('.g-bs-pane[data-pos="active"] h2').textContent).toBe('Daily targets')
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(useStore.getState().S).toBe(own)
    expect(localStorage.getItem('gym_state_v1')).toBe('{"real":true}')
  }, 60000)
})
