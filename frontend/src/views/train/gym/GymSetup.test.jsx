// @vitest-environment happy-dom
// Gym setup (T12.0, /me/equipment): the profile chips (each sets the active profile, + New opens an
// empty profile, Edit profile opens the active one), Filter by equipment as a switch, the plates and
// dumbbells as the one inventory every profile shares, and the rows a Settings search hit lands on.
// It replaces the Settings Equipment card, so what that card did has to be here.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { click, useView } from '../../../ds/render.test-util.js'
import { dumbbellInventorySheet, equipmentProfileSheet, plateInventorySheet } from '../../../sheets.jsx'
import { useStore } from '../../../store/useStore.js'
import GymSetup from './GymSetup.jsx'

vi.mock('../../../sheets.jsx', () => ({ dumbbellInventorySheet: vi.fn(), equipmentProfileSheet: vi.fn(), plateInventorySheet: vi.fn() }))

const view = useView()
const S = () => useStore.getState().S
const home = { id: 'home', name: 'Home gym', equipment: ['dumbbell'], accV: 1 }
const city = { id: 'city', name: 'City Gym', equipment: ['barbell'], accV: 1 }
const setS = (over = {}) => useStore.setState(s => ({
  S: { ...s.S, unit: 'kg', equipProfiles: [home, city], activeEquipId: 'home', equipFilterOn: false, plates: {}, dumbbells: {}, ...over },
}))
const chips = () => [...view.host.querySelectorAll('.g-cchip')]
const chip = label => chips().find(c => c.textContent === label)
const rows = () => [...view.host.querySelectorAll('.g-glist-row')]
const row = title => rows().find(r => r.querySelector('b').textContent === title)
const section = id => view.host.querySelector('#' + id)

beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
  setS()
})
afterEach(() => { vi.useRealTimers() })

describe('Gym setup', () => {
  it('is a pushed page titled Gym setup, with its line, and no Bars or Machines', () => {
    view.render(<GymSetup />)
    expect(view.host.querySelector('.g-screen-pushed')).not.toBeNull()
    expect(view.host.querySelector('.g-spage-title').textContent).toBe('Gym setup')
    expect(view.host.querySelector('.g-spage-sub').textContent).toBe('Used for plate maths and plan fitting')
    expect(view.host.textContent).not.toMatch(/\b(Bars|Machines)\b/)
    expect(view.host.textContent).toContain('Ready-made plans can fit to this profile, and the workout shows which plates to load.')
  })
})

describe('the profile chips', () => {
  it('list the profiles with the active one lit, then + New', () => {
    view.render(<GymSetup />)
    expect(chips().map(c => c.textContent)).toEqual(['Home gym', 'City Gym', '+ New'])
    expect(chip('Home gym').getAttribute('aria-pressed')).toBe('true')
    expect(chip('City Gym').getAttribute('aria-pressed')).toBe('false')
    expect(chip('+ New').getAttribute('aria-pressed')).toBe('false')
  })

  it('a tap makes that profile the active one', () => {
    view.render(<GymSetup />)
    click(chip('City Gym'))
    expect(S().activeEquipId).toBe('city')
    expect(chip('City Gym').getAttribute('aria-pressed')).toBe('true')
  })

  it('+ New opens an empty profile and leaves the active one alone', () => {
    view.render(<GymSetup />)
    click(chip('+ New'))
    expect(equipmentProfileSheet).toHaveBeenCalledWith(null)
    expect(S().activeEquipId).toBe('home')
    expect(chip('Home gym').getAttribute('aria-pressed')).toBe('true')
  })

  it('Edit profile opens the active one; with none active there is nothing to edit', () => {
    view.render(<GymSetup />)
    expect(section('gym-profiles').textContent).toContain('1 equipment types')   // what Home gym has ticked
    click([...view.host.querySelectorAll('.tcp-link')].find(b => b.textContent === 'Edit profile'))
    expect(equipmentProfileSheet).toHaveBeenCalledWith(expect.objectContaining({ id: 'home' }))
    setS({ activeEquipId: null })
    view.render(<GymSetup />)
    expect([...view.host.querySelectorAll('.tcp-link')]).toHaveLength(0)
  })

  it('with no profile there is only + New, and no filter', () => {
    setS({ equipProfiles: [], activeEquipId: null })
    view.render(<GymSetup />)
    expect(chips().map(c => c.textContent)).toEqual(['+ New'])
    expect(row('Filter by equipment')).toBeUndefined()
  })
})

describe('Filter by equipment', () => {
  it('is a switch named for what it does, off to begin with, and it writes the setting', () => {
    view.render(<GymSetup />)
    const sw = view.host.querySelector('[role="switch"]')
    expect(sw.getAttribute('aria-label')).toBe('Filter by equipment')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    click(sw)
    expect(S().equipFilterOn).toBe(true)
    expect(view.host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    click(view.host.querySelector('[role="switch"]'))
    expect(S().equipFilterOn).toBe(false)
  })

  it('says what filtering does to the library and the plan', () => {
    view.render(<GymSetup />)
    expect(view.host.textContent).toContain('flags routine exercises that need something you don’t have in the active profile')
  })
})

describe('Plates', () => {
  it('shows the standard set for the unit when none is counted, and says so', () => {
    view.render(<GymSetup />)
    const plates = section('gym-plates')
    expect([...plates.querySelectorAll('.g-glist-row')].map(r => r.textContent)).toEqual([
      '25 kg× 6', '20 kg× 6', '15 kg× 6', '10 kg× 6', '5 kg× 6', '2.5 kg× 6', '1.25 kg× 6',
    ])
    expect(plates.textContent).toContain('Standard set. Tap to count the pairs you own.')
    expect(plates.textContent).toContain('the same in every profile')
  })

  it('shows your own list, in pairs, and says it is yours', () => {
    setS({ plates: { kg: { 20: 2, 5: 4, _ts: 1 } } })
    view.render(<GymSetup />)
    const plates = section('gym-plates')
    expect([...plates.querySelectorAll('.g-glist-row')].map(r => r.textContent)).toEqual(['20 kg× 2', '5 kg× 4'])
    expect(plates.textContent).toContain('Your own list for kg.')
  })

  it('follows a pound profile', () => {
    setS({ unit: 'lb' })
    view.render(<GymSetup />)
    expect(section('gym-plates').querySelector('.g-glist-row').textContent).toBe('45 lb× 6')
  })

  it('a tap on any size opens the plates drawer', () => {
    view.render(<GymSetup />)
    click(section('gym-plates').querySelectorAll('.g-glist-row')[2])
    expect(plateInventorySheet).toHaveBeenCalledTimes(1)
  })
})

describe('Dumbbells', () => {
  it('says any weight until the bells are listed, then lists them', () => {
    view.render(<GymSetup />)
    expect(section('gym-bells').textContent).toContain('Any weight. Tap to list the ones you own.')
    setS({ dumbbells: { kg: { weights: [10, 12.5, 4], _ts: 1 } } })
    view.render(<GymSetup />)
    expect(section('gym-bells').querySelector('.g-glist-row b').textContent).toBe('4 · 10 · 12.5')
    expect(section('gym-bells').textContent).toContain('the same in every profile')
  })

  it('a tap opens the dumbbells drawer', () => {
    view.render(<GymSetup />)
    click(section('gym-bells').querySelector('.g-glist-row'))
    expect(dumbbellInventorySheet).toHaveBeenCalledTimes(1)
  })
})

describe('landing a Settings search hit', () => {
  const flashed = id => section(id).classList.contains('tcp-flash')

  it.each([
    ['Plates', 'gym-plates'],
    ['Dumbbells', 'gym-bells'],
    ['Filter by equipment', 'gym-filter'],
    ['Active profile', 'gym-profiles'],
    ['Add equipment profile', 'gym-profiles'],
  ])('%s scrolls to its part and flashes it', (find, id) => {
    view.render(<GymSetup find={find} />)
    expect(flashed(id)).toBe(true)
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('stops flashing after a moment', () => {
    vi.useFakeTimers()
    view.render(<GymSetup find="Plates" />)
    expect(flashed('gym-plates')).toBe(true)
    act(() => { vi.advanceTimersByTime(2000) })
    expect(flashed('gym-plates')).toBe(false)
  })

  it('flashes nothing without a hit, or for a title this page does not hold', () => {
    view.render(<GymSetup />)
    view.render(<GymSetup find="Reminders" />)
    expect(view.host.querySelector('.tcp-flash')).toBeNull()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})
