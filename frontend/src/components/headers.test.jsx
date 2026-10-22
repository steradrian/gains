// @vitest-environment happy-dom
// The tab-root header (owner direction, PR-07: the bearmenu header, the stage's avatar · search
// field · bell, fixed to the top, nothing moving while searching but the bell turning into ×), and
// the sub-page header (back · centred title · ≤2 actions).
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { longFits, titleStep } from '../lib/text-fit.js'
import { endSearch, useSearch } from '../lib/search/session.js'
import RootHeader from './RootHeader.jsx'
import SubHeader from './SubHeader.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  vi.spyOn(history, 'back').mockImplementation(() => {})
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  act(() => endSearch())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const render = el => act(() => root.render(el))
const $ = s => host.querySelector(s)
const typeInto = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })) })

let where = null
function Where() { where = useLocation().pathname; return null }
// A router of its own per path, so each call starts at its address.
const at = (path, el) => render(<MemoryRouter key={path} initialEntries={[path]}>{el}<Where /></MemoryRouter>)
const input = () => $('[role="search"] input')
const avatar = () => $('.g-sbtn:not(.g-bell)')
const bell = () => $('.g-bell')

describe('RootHeader (the tab-root header)', () => {
  it('is the stage header pinned to the top: avatar, field, context readout, bell, with a hidden h1', () => {
    at('/food', <RootHeader title="Nutrition" action={<button className="hdr-left">1,240 left</button>} />)
    const hdr = $('.g-root > header.g-shdr')
    expect(hdr.classList.contains('g-shdr-pin')).toBe(true)
    expect($('.g-root').getAttribute('data-accent')).toBeTruthy()
    const part = c => (c.tagName === 'H1' ? 'h1' : c.classList.contains('g-bell') ? 'bell' : c.classList.contains('g-spill') ? 'field'
      : c.classList.contains('g-shdr-act') ? 'action' : c.classList.contains('g-sbtn') ? 'avatar' : c.className)
    // No ground of its own: the shared stage is behind it.
    expect([...hdr.children].map(part)).toEqual(['h1', 'avatar', 'field', 'action', 'bell'])
    expect($('h1').className).toBe('sr-only')
    expect($('h1').textContent).toBe('Nutrition')
    // A spacer keeps the page's first block clear of it; there is no line under it.
    expect($('.root-hdr-space')).not.toBeNull()
    expect($('.tab-hdr')).toBeNull()
  })

  it('the field is the real input, with bearmenu\'s attributes, inside a search landmark around its glyph', () => {
    at('/train', <RootHeader title="Training" />)
    expect(input().getAttribute('type')).toBe('text')
    expect(input().getAttribute('inputmode')).toBe('search')
    for (const [k, v] of [['autocomplete', 'off'], ['autocorrect', 'off'], ['autocapitalize', 'off'], ['spellcheck', 'false'], ['enterkeyhint', 'search']]) {
      expect(input().getAttribute(k), k).toBe(v)
    }
    // The placeholder names the scope for a screen reader too.
    expect(input().getAttribute('aria-label')).toBe('Search training')
    const pill = $('[role="search"]')
    expect(pill.tagName).toBe('LABEL')
    expect(pill.querySelector('svg')).not.toBeNull()
  })

  it('reads the tab from the address, not from the page: Progress is Me\'s', () => {
    for (const [path, text] of [['/train', 'Search training'], ['/food', 'Search food'], ['/progress', 'Search Gains']]) {
      at(path, <RootHeader title="x" />)
      expect(input().placeholder, path).toBe(text)
    }
  })

  it('focus opens the search on the tab it is on; the header stays and its bell turns into ×', () => {
    at('/food', <RootHeader title="Nutrition" />)
    expect(input().getAttribute('role')).toBe('combobox')
    expect(input().getAttribute('aria-haspopup')).toBe('listbox')
    expect(input().getAttribute('aria-expanded')).toBe('false')
    expect(input().hasAttribute('aria-controls')).toBe(false)
    act(() => input().focus())
    expect(useSearch.getState()).toMatchObject({ open: true, tab: 'food' })
    expect(input().getAttribute('aria-expanded')).toBe('true')
    expect(input().getAttribute('aria-controls')).toBe('gains-search-list')
    expect(bell().getAttribute('aria-label')).toBe('Close search')
    expect(avatar()).not.toBeNull()
  })

  it('keeps what was typed while search is open, and × closes it, the field empty again', () => {
    at('/home', <RootHeader title="Home" />)
    act(() => input().focus())
    typeInto(input(), 'chicken')
    expect(useSearch.getState().query).toBe('chicken')
    expect(input().value).toBe('chicken')
    act(() => bell().click())
    expect(useSearch.getState().open).toBe(false)
    expect(input().value).toBe('')
    expect(bell().getAttribute('aria-label')).toBe('Notifications')
  })

  it('Escape empties the field and keeps it open, then closes', () => {
    at('/train', <RootHeader title="Training" />)
    act(() => input().focus())
    typeInto(input(), 'bench')
    key(input(), 'Escape')
    expect(useSearch.getState()).toMatchObject({ open: true, query: '' })
    key(input(), 'Escape')
    expect(useSearch.getState().open).toBe(false)
  })

  it('a scope sits in the field as a chip; its × shows everything again', () => {
    at('/train', <RootHeader title="Training" />)
    act(() => input().focus())
    act(() => useSearch.setState({ group: 'workouts' }))
    expect($('.g-ssf-scope').textContent).toBe('Workouts')
    act(() => $('.g-ssf-scope-x').click())
    expect(useSearch.getState().group).toBe(null)
    expect($('.g-ssf-scope')).toBeNull()
  })

  it('the avatar opens Profile from Today, Train and Eat and Settings on the Me tab; the bell the notifications under its own tab', () => {
    at('/food', <RootHeader title="Nutrition" />)
    act(() => bell().click())
    expect(where).toBe('/food/notifications')
    at('/train', <RootHeader title="Training" />)
    expect(avatar().getAttribute('aria-label')).toBe('Settings')
    act(() => avatar().click())
    expect(where).toBe('/me')
    at('/me', <RootHeader title="Profile" />)
    act(() => avatar().click())
    expect(where).toBe('/me/settings')
    at('/progress', <RootHeader title="Progress" />)
    act(() => avatar().click())
    expect(where).toBe('/me/settings')
    at('/progress', <RootHeader title="Progress" />)
    act(() => bell().click())
    expect(where).toBe('/me/notifications')
  })

  it('measures with the letter spacing', () => {
    expect(longFits('abcd', 32, s => s.length * 8)).toBe(true)
    expect(longFits('abcd', 31, s => s.length * 8)).toBe(false)
  })
})

describe('SubHeader (the sub-page header)', () => {
  it('is back, the title with its sub, and the actions, on three columns', () => {
    const onBack = vi.fn()
    render(<SubHeader title="Weigh-ins" sub="12 entries" onBack={onBack} action={<button className="iconbtn" aria-label="Add">+</button>} />)
    const hdr = $('.hdr.sub-hdr')
    expect([...hdr.children].map(c => c.className)).toEqual(['iconbtn hdr-btn', 'sub-hdr-t', 'hdr-actions'])
    expect($('h1').textContent).toBe('Weigh-ins')
    expect($('.sub').textContent).toBe('12 entries')
    act(() => $('button[aria-label="Back"]').click())
    expect(onBack).toHaveBeenCalled()
  })

  it('keeps the third column with no action, so the title stays centred', () => {
    render(<SubHeader title="History" />)
    expect($('.hdr-actions')).not.toBeNull()
    expect($('.hdr-actions').children).toHaveLength(0)
  })

  it('takes two actions and throws in development on a third', () => {
    const two = <><button>a</button><button>b</button></>
    render(<SubHeader title="Plan" action={two} />)
    expect($('.hdr-actions').children).toHaveLength(2)
    expect(() => render(<SubHeader title="Plan" action={<><button>a</button><button>b</button><button>c</button></>} />)).toThrow(/at most two actions/)
  })

  it('takes a field as its title, at full width', () => {
    render(<SubHeader><input aria-label="Routine name" /></SubHeader>)
    expect($('.hdr').classList.contains('sub-hdr-field')).toBe(true)
    expect($('.sub-hdr-t input')).not.toBeNull()
    expect($('h1')).toBeNull()
  })

  it('pins itself with `sticky`', () => {
    render(<SubHeader title="Strength" sticky />)
    expect($('.hdr').classList.contains('sticky')).toBe(true)
  })

  // Measured at 320px in Chrome: «Упражнения» (131px at 22px bold) beside «По мышцам» has 118px.
  it('steps the title down to the largest size that keeps every word whole in two lines', () => {
    const measure = (s, size) => s.length * size * 0.6   // 13.2px a letter at 22px
    expect(titleStep('Exercises', 192, measure)).toBe(0)
    expect(titleStep('Упражнения', 130, measure)).toBe(1)   // 132 at 22, 120 at 20
    expect(titleStep('Упражнения', 118, measure)).toBe(2)   // 102 at 17
    expect(titleStep('Fortschrittsfotos', 60, measure)).toBe(2)   // the smallest, hyphenated
    // short words, but more than two lines' worth at 22px
    expect(titleStep('Connected apps and health data', 120, measure)).toBe(2)
  })

  it('puts the step on the h1 from the room back and the actions leave', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '', measureText: function (s) { return { width: s.length * parseFloat(/(\d+)px/.exec(this.font)?.[1] || 22) * 0.6 } },
    })
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(288)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function () { return this.classList.contains('hdr-actions') ? 120 : 40 })
    render(<SubHeader title="Упражнения" action={<button className="btn sm">По мышцам</button>} />)
    // 288 − 40 − 120 = 128px of room: 132 at 22 does not fit, 120 at 20 does
    expect($('h1').className).toBe('fit-1')
    render(<SubHeader title="History" />)
    expect($('h1').hasAttribute('class')).toBe(false)
  })
})
