// @vitest-environment happy-dom
// StageDayRail (boards T2.0, T2.3, T2.14): weeks of seven cells, a title and a link, ‹ › and a swipe.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import StageDayRail from './StageDayRail.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

const day = (iso, dow, date, state, label, name) => ({ iso, dow, date, state, label, name })
const THIS_WEEK = [
  day('2026-10-15', 'T', 15, 'rest', 'Thu 15 Oct, rest'),
  day('2026-10-16', 'F', 16, 'missed', 'Fri 16 Oct, Legs', 'Legs'),
  day('2026-10-17', 'S', 17, 'noted', 'Sat 17 Oct, note'),
  day('2026-10-18', 'S', 18, 'today', 'Sun 18 Oct, Push A', 'Push A'),
  day('2026-10-19', 'M', 19, 'planned', 'Mon 19 Oct, Legs', 'Legs'),
  day('2026-10-20', 'T', 20, 'rest', 'Tue 20 Oct, rest'),
  day('2026-10-21', 'W', 21, 'planned', 'Wed 21 Oct, Pull A', 'Pull A + Legs'),
]
const NEXT_WEEK = THIS_WEEK.map(d => ({ ...d, iso: 'n' + d.iso, label: 'Next ' + d.label }))
const EARLIER = THIS_WEEK.map(d => ({ ...d, iso: 'e' + d.iso, state: 'done', label: 'Earlier ' + d.label }))
const WEEKS = [EARLIER, THIS_WEEK, NEXT_WEEK]

const rail = (props = {}) => (
  <StageDayRail weeks={WEEKS} week={1} home={1} title="This week" action="Plan" onAction={() => {}} {...props} />
)
const track = () => view.host.querySelector('.g-rail-track')
const cells = () => [...view.host.querySelectorAll('.g-rail-page:not([inert]) .g-rd')]

function pointer(el, type, x, y = 0) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' }))
  })
}
const swipe = (el, from, to) => {
  pointer(el, 'pointerdown', from)
  pointer(el, 'pointermove', (from + to) / 2)
  pointer(el, 'pointermove', to)
  pointer(el, 'pointerup', to)
}

describe('StageDayRail', () => {
  it('draws the title and the action link, and seven cells for the week shown', () => {
    view.render(rail({ actionHref: '#/train/schedule' }))
    expect(view.host.querySelector('.g-rail-title').textContent).toBe('This week')
    expect(view.host.querySelector('.g-rail-act').tagName).toBe('A')
    expect(cells()).toHaveLength(7)
  })

  it('a cell has the caller\'s label as its name, its letter, its number, a mark and the first word of the workout', () => {
    view.render(rail())
    const [, fri, , sun, , , wed] = cells()
    expect(fri.getAttribute('aria-label')).toBe('Fri 16 Oct, Legs')
    expect(fri.textContent).toBe('F16Legs')
    expect(fri.querySelector('.g-rd-dot').className).toContain('g-rd-missed')
    expect(sun.querySelector('.g-rd-dot').className).toContain('g-rd-today')
    expect(wed.querySelector('.g-rd-tag').textContent).toBe('Pull')
  })

  it('a day with a ring (Eat) draws the date inside it, no mark and no tag, amber when over, bare when empty', () => {
    const ringed = [
      { ...THIS_WEEK[0], ring: { value: 0.5, over: false } },
      { ...THIS_WEEK[1], ring: { value: 1, over: true } },
      { ...THIS_WEEK[2], ring: { value: 0, over: false }, disabled: true },
    ]
    view.render(rail({ weeks: [ringed], week: 0, home: 0 }))
    const [half, over, bare] = cells()
    expect(half.querySelector('.g-rd-ring b').textContent).toBe('15')
    expect(half.querySelector('.g-rd-dot, .g-rd-tag')).toBeNull()
    expect(half.querySelector('.g-rd-arc').getAttribute('stroke-dashoffset')).toBe((2 * Math.PI * 18.25 * 0.5).toFixed(1))
    expect(over.querySelector('.g-rd-arc').classList.contains('over')).toBe(true)
    expect(bare.querySelector('.g-rd-arc')).toBeNull()
    expect(bare.disabled).toBe(true)
  })

  it('shows the cell with `selected` lit and presses it; today keeps its own mark when another is selected', () => {
    view.render(rail({ selected: '2026-10-19' }))
    const on = cells().filter(c => c.classList.contains('on'))
    expect(on.map(c => c.getAttribute('aria-label'))).toEqual(['Mon 19 Oct, Legs'])
    expect(on[0].getAttribute('aria-pressed')).toBe('true')
    expect(cells()[3].classList.contains('now')).toBe(true)
    expect(cells()[3].getAttribute('aria-pressed')).toBe('false')
  })

  it('tells onSelect which day was tapped', () => {
    const onSelect = vi.fn()
    view.render(rail({ onSelect }))
    click(cells()[4])
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ iso: '2026-10-19' }))
  })

  it('a day with an href is a link', () => {
    const weeks = [[{ ...THIS_WEEK[0], href: '#/day/1' }, ...THIS_WEEK.slice(1)]]
    view.render(rail({ weeks, week: 0, home: 0 }))
    expect(cells()[0].tagName).toBe('A')
    expect(cells()[1].tagName).toBe('BUTTON')
  })

  it('a disabled day cannot be tapped', () => {
    const onSelect = vi.fn()
    const weeks = [[{ ...THIS_WEEK[0], state: 'plain', disabled: true }, ...THIS_WEEK.slice(1)]]
    view.render(rail({ weeks, week: 0, home: 0, onSelect }))
    expect(cells()[0].disabled).toBe(true)
    expect(cells()[1].disabled).toBe(false)
    click(cells()[0])
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('rejects an unknown state while developing', () => {
    const weeks = [[{ ...THIS_WEEK[0], state: 'bogus' }]]
    expect(() => view.render(rail({ weeks, week: 0, home: 0 }))).toThrow()
  })

  it('moves the track to the week asked for and keeps the other weeks out of reach', () => {
    view.render(rail({ week: 2 }))
    expect(track().style.getPropertyValue('--week')).toBe('2')
    const pages = [...view.host.querySelectorAll('.g-rail-page')]
    expect(pages.map(p => p.hasAttribute('inert'))).toEqual([true, true, false])
    expect(cells()[0].getAttribute('aria-label')).toBe('Next Thu 15 Oct, rest')
  })

  describe('the arrows', () => {
    it('› asks for the next week with the caller\'s name for it', () => {
      const onWeek = vi.fn()
      view.render(rail({ onWeek, forwardLabel: 'Next week' }))
      click(view.host.querySelector('[aria-label="Next week"]'))
      expect(onWeek).toHaveBeenCalledWith(2)
    })

    it('‹ on this week is only a keyboard stop, and away from it is drawn', () => {
      const onWeek = vi.fn()
      view.render(rail({ onWeek, backLabel: 'Earlier week' }))
      const quiet = view.host.querySelector('[aria-label="Earlier week"]')
      expect(quiet.classList.contains('g-rail-quiet')).toBe(true)
      click(quiet)
      expect(onWeek).toHaveBeenCalledWith(0)
      view.render(rail({ week: 2, onWeek, backLabel: 'This week' }))
      expect(view.host.querySelector('.g-rail-btn[aria-label="This week"]').classList.contains('g-rail-quiet')).toBe(false)
    })

    it('keeps both arrows, › disabled at the last week or when the caller says the rail stops, ‹ at the first', () => {
      const disabled = () => [...view.host.querySelectorAll('.g-rail-btn')].map(b => b.getAttribute('aria-disabled') === 'true')
      view.render(rail({ week: 2 }))
      expect(disabled()).toEqual([false, true])
      view.render(rail({ week: 1, canForward: false, canBack: false }))
      expect(disabled()).toEqual([true, true])
      view.render(rail({ week: 0, home: 1 }))
      expect(disabled()).toEqual([true, false])
    })

    it('a keyboard step onto the last week keeps focus on the arrow', () => {
      let week = 1
      const onWeek = i => { week = i; view.render(rail({ week, onWeek, forwardLabel: 'Later' })) }
      view.render(rail({ week, onWeek, forwardLabel: 'Later' }))
      const next = view.host.querySelector('[aria-label="Later"]')
      next.focus()
      click(next)
      expect(week).toBe(2)
      const after = view.host.querySelector('[aria-label="Later"]')
      expect(after).toBe(next)
      expect(after.getAttribute('aria-disabled')).toBe('true')
      expect(document.activeElement).toBe(next)
      // At the end it asks for nothing.
      click(after)
      expect(week).toBe(2)
    })
  })

  describe('swiping', () => {
    it('right to left (dir=rtl): a drag right asks for the next week, left for the one before', () => {
      const onWeek = vi.fn()
      view.host.setAttribute('dir', 'rtl')
      view.render(rail({ onWeek }))
      const el = view.host.querySelector('.g-rail-view')
      el.style.direction = 'rtl'
      swipe(el, 100, 220)
      expect(onWeek).toHaveBeenLastCalledWith(2)
      swipe(el, 300, 200)
      expect(onWeek).toHaveBeenLastCalledWith(0)
      view.host.removeAttribute('dir')
    })

    it('a drag left past the threshold asks for the next week; right for the one before', () => {
      const onWeek = vi.fn()
      view.render(rail({ onWeek }))
      const el = view.host.querySelector('.g-rail-view')
      swipe(el, 300, 200)
      expect(onWeek).toHaveBeenLastCalledWith(2)
      swipe(el, 100, 220)
      expect(onWeek).toHaveBeenLastCalledWith(0)
      expect(onWeek).toHaveBeenCalledTimes(2)
    })

    it('a short drag, a mostly vertical one or a cancelled one turns nothing', () => {
      const onWeek = vi.fn()
      view.render(rail({ onWeek }))
      const el = view.host.querySelector('.g-rail-view')
      swipe(el, 300, 280)
      pointer(el, 'pointerdown', 300, 0)
      pointer(el, 'pointermove', 250, 200)
      pointer(el, 'pointerup', 150, 200)
      pointer(el, 'pointerdown', 300)
      pointer(el, 'pointermove', 200)
      pointer(el, 'pointercancel', 100)
      expect(onWeek).not.toHaveBeenCalled()
      expect(track().style.getPropertyValue('--drag')).toBe('0px')
    })

    it('does not go past an end the caller set, and gives a little instead of the full drag', () => {
      const onWeek = vi.fn()
      view.render(rail({ onWeek, canForward: false }))
      const el = view.host.querySelector('.g-rail-view')
      pointer(el, 'pointerdown', 300)
      pointer(el, 'pointermove', 200)
      expect(track().style.getPropertyValue('--drag')).toBe('-25px')
      pointer(el, 'pointerup', 200)
      expect(onWeek).not.toHaveBeenCalled()
    })

    it('the click that ends a drag is not a tap on the cell under the finger', () => {
      const onSelect = vi.fn()
      view.render(rail({ onSelect, onWeek: () => {} }))
      const el = view.host.querySelector('.g-rail-view')
      swipe(el, 300, 200)
      click(cells()[0])
      expect(onSelect).not.toHaveBeenCalled()
      return new Promise(r => setTimeout(r, 5)).then(() => {
        click(cells()[0])
        expect(onSelect).toHaveBeenCalledTimes(1)
      })
    })
  })
})
