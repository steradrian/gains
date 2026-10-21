// @vitest-environment happy-dom
// The Eat root (boards Ea1Eat, Ea1Off; PR04Graph E1.0, PR04Edges E1.0): the rail's taps, the ring
// carousel, the action row, Again, Your food, and the invitation when food tracking is off.
import { describe, expect, it, vi } from 'vitest'
import { AGAIN, LIBRARY, base, rail } from '../../dev/screens/states/eat-root-fixture.js'
import { click, useView } from '../../ds/render.test-util.js'
import EatScreen from './EatScreen.jsx'

// The plate scene arrives with the motion branch's scenes file; the kit throws on an unknown name.
vi.mock('../../ds/Illustration.jsx', () => ({ default: ({ name }) => <i data-scene={name} /> }))

const view = useView()
const named = label => [...view.host.querySelectorAll('button, a')].find(el => (el.getAttribute('aria-label') || el.textContent).trim() === label)
const cells = () => [...view.host.querySelectorAll('.g-rail-page:not([inert]) .g-rd')]

describe('the rail', () => {
  it('is a ring a day, this week first, and a past day, today and Month each go where the screen is told', () => {
    const onDay = vi.fn(), onMonth = vi.fn()
    view.render(<EatScreen {...base} rail={{ ...base.rail, onDay, onMonth }} />)
    expect(cells()).toHaveLength(7)
    expect(view.host.querySelector('.g-rail-title').textContent).toBe('This week · 12 to 18 Oct')
    click(cells()[2])
    expect(onDay).toHaveBeenLastCalledWith(expect.objectContaining({ iso: '2026-10-14' }))
    click(cells()[6])
    expect(onDay).toHaveBeenLastCalledWith(expect.objectContaining({ iso: '2026-10-18', state: 'today' }))
    click(named('Month'))
    expect(onMonth).toHaveBeenCalledTimes(1)
  })

  it('turns a day over its goal amber, with no copy about it', () => {
    view.render(<EatScreen {...base} />)
    const over = [...view.host.querySelectorAll('.g-rail-page:not([inert]) .g-rd-arc.over')]
    expect(over).toHaveLength(1)
    expect(over[0].closest('.g-rd').getAttribute('aria-label')).toContain('108% of target')
  })

  it('dims a day to come and does not let it be tapped', () => {
    const onDay = vi.fn()
    const week = base.rail.weeks[2]
    const days = week.days.map((d, i) => (i > 3 ? { ...d, state: 'plain', disabled: true, ring: { value: 0, over: false } } : d))
    const weeks = [...base.rail.weeks.slice(0, 2), { ...week, days }]
    view.render(<EatScreen {...base} rail={{ ...base.rail, weeks, onDay }} />)
    const later = cells()[5]
    expect(later.disabled).toBe(true)
    click(later)
    expect(onDay).not.toHaveBeenCalled()
  })

  it('pages back a week at a time through ‹', () => {
    const onWeek = vi.fn()
    view.render(<EatScreen {...base} rail={{ ...rail(), onWeek }} />)
    click(view.host.querySelector('.g-rail-btn[aria-label="5 to 11 Oct"]'))
    expect(onWeek).toHaveBeenCalledWith(1)
  })
})

describe('the week ring', () => {
  it('opens Trends on a tap, one slide for the week, the average and the protein', () => {
    const onOpen = vi.fn()
    view.render(<EatScreen {...base} hero={{ ...base.hero, onOpen }} />)
    const slides = [...view.host.querySelectorAll('.g-rc-slide')]
    expect(slides).toHaveLength(3)
    expect(slides[0].getAttribute('aria-label')).toContain('4 of 6 days on target')
    click(slides[0])
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('the actions', () => {
  it('Log food, Scan, Saved meals and the water glass each run what they are given', () => {
    const actions = base.actions.map(a => ({ ...a, onClick: vi.fn() }))
    view.render(<EatScreen {...base} actions={actions} />)
    for (const a of actions) {
      click(named(a.label))
      expect(a.onClick).toHaveBeenCalledTimes(1)
    }
  })
})

describe('Again', () => {
  it('offers Yesterday’s lunch and logs it on Log again', () => {
    const onLog = vi.fn()
    view.render(<EatScreen {...base} again={{ ...AGAIN, onLog }} />)
    expect(view.host.textContent).toContain('Chicken rice bowl · 540 kcal')
    click(named('Log yesterday’s lunch again'))
    expect(onLog).toHaveBeenCalledTimes(1)
  })

  it('reads Logged afterwards, with nothing left to tap', () => {
    view.render(<EatScreen {...base} again={{ ...AGAIN, done: true }} />)
    expect(view.host.querySelector('.eat-logged').textContent).toBe('Logged')
    expect(named('Log again')).toBeUndefined()
  })

  it('is gone when yesterday cannot be logged again', () => {
    view.render(<EatScreen {...base} again={null} />)
    expect(view.host.textContent).not.toContain('Yesterday’s lunch')
    expect([...view.host.querySelectorAll('h2')].map(h => h.textContent)).toEqual(['Your food'])
  })
})

describe('Your food', () => {
  it('lists the places with what each holds, and leaves out a row it is not given', () => {
    view.render(<EatScreen {...base} library={LIBRARY.filter(r => r.key !== 'burned')} />)
    const rows = [...view.host.querySelectorAll('.g-glist-row')].map(r => r.querySelector('b').textContent)
    expect(rows).toEqual(['Foods', 'Saved meals', 'Recipes', 'Trends', 'Fasting', 'Daily targets', 'Food settings'])
    expect(view.host.textContent).toContain('42 foods · 3 favourites')
  })

  it('opens a row through what it was given', () => {
    const goals = vi.fn()
    view.render(<EatScreen {...base} library={LIBRARY.map(r => (r.key === 'goals' ? { ...r, onClick: goals } : r))} />)
    click(named('Daily targets2,100 kcal · 150 g protein'))
    expect(goals).toHaveBeenCalledTimes(1)
  })
})

describe('food tracking off', () => {
  it('is an invitation, never a blank tab, and Set up food tracking opens the targets', () => {
    const onSetup = vi.fn()
    view.render(<EatScreen {...base} status="off" setup={{ onSetup }} />)
    expect(view.host.querySelector('[data-scene="plate"]')).not.toBeNull()
    expect(view.host.textContent).toContain('Add food tracking')
    expect(view.host.querySelector('.g-rail')).toBeNull()
    click(named('Set up food tracking'))
    expect(onSetup).toHaveBeenCalledTimes(1)
  })

  it('makes no promise about My goal, which the app has no inputs for', () => {
    view.render(<EatScreen {...base} status="off" />)
    expect(view.host.textContent).not.toContain('My goal')
  })
})

describe('nutrition not available', () => {
  it('says so with a scene and no way in', () => {
    view.render(<EatScreen {...base} status="unavailable" />)
    expect(view.host.textContent).toContain('Nutrition lives in the web app')
    expect(view.host.querySelector('.g-rail')).toBeNull()
  })
})
