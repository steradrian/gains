// @vitest-environment happy-dom
// RingCarousel: one ring per page, a link or button per slide, dots outside the scroller that are
// buttons, and the page shown reported once per change whether it came from a swipe or a dot.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RingCarousel from './RingCarousel.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)
const qa = sel => [...view.host.querySelectorAll(sel)]
const WIDTH = 390

const SLIDES = [
  { name: 'Calories', top: 'Left today', big: '1,240', unit: 'kcal of 2,100', value: 860, max: 2100, pill: '860 eaten', icon: 'flame' },
  { name: 'Protein', top: 'Protein left', big: '9', unit: 'g of 150 g', value: 141, max: 150, pill: '141 g eaten', icon: 'utensils' },
  { name: 'Carbs', top: 'Carbs left', big: '120', unit: 'g of 230 g', value: 110, max: 230 },
  { name: 'Fat', top: 'Fat left', big: '30', unit: 'g of 70 g', value: 40, max: 70 },
]

// happy-dom has no layout: the scroller is 390 wide, and scrollTo moves it like a browser would
let scrollTo
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.classList.contains('g-rc') ? WIDTH : 0 } })
  scrollTo = vi.fn()
  HTMLElement.prototype.scrollTo = scrollTo
})
afterEach(() => {
  delete HTMLElement.prototype.clientWidth
  delete HTMLElement.prototype.scrollTo
  delete document.documentElement.dataset.motion
})

const scrollToPage = i => act(() => {
  q('.g-rc').scrollLeft = i * WIDTH
  q('.g-rc').dispatchEvent(new Event('scroll'))
})
const dots = () => qa('.g-rc-dot')
const activeDot = () => dots().findIndex(d => d.getAttribute('aria-current') === 'true')

describe('RingCarousel', () => {
  it('draws a ring, its pill and a name for each slide', () => {
    view.render(<RingCarousel slides={SLIDES} />)
    const slides = qa('.g-rc-slide')
    expect(slides).toHaveLength(4)
    expect(slides.map(s => s.getAttribute('aria-label'))).toEqual([
      'Calories: 1,240 kcal of 2,100. Open details',
      'Protein: 9 g of 150 g. Open details',
      'Carbs: 120 g of 230 g. Open details',
      'Fat: 30 g of 70 g. Open details',
    ])
    expect(slides.map(s => s.querySelector('.g-rc-pill')?.textContent ?? null)).toEqual(['860 eaten', '141 g eaten', null, null])
    expect(slides[0].querySelector('.g-rc-pill [data-icon="flame"]')).not.toBeNull()
    expect(slides[0].querySelector('.g-sring')).not.toBeNull()
  })

  it('groups the carousel under a label', () => {
    view.render(<RingCarousel slides={SLIDES} />)
    expect(q('[role="group"]').getAttribute('aria-label')).toBe('Today at a glance')
    view.render(<RingCarousel slides={SLIDES} label="Rings" />)
    expect(q('[role="group"]').getAttribute('aria-label')).toBe('Rings')
  })

  it('makes a button of a slide, a link of one with an href, and falls back on the carousel href', () => {
    view.render(<RingCarousel slides={[SLIDES[0], { ...SLIDES[1], href: '#/trends' }, SLIDES[2]]} href="#/nutrition" />)
    const slides = qa('.g-rc-slide')
    expect(slides.map(s => s.getAttribute('href'))).toEqual(['#/nutrition', '#/trends', '#/nutrition'])
    view.render(<RingCarousel slides={SLIDES} />)
    expect(qa('.g-rc-slide').map(s => s.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
  })

  it('opens the slide tapped, with its index', () => {
    const onOpen = vi.fn()
    view.render(<RingCarousel slides={SLIDES} onOpen={onOpen} />)
    click(qa('.g-rc-slide')[1])
    expect(onOpen).toHaveBeenCalledWith(SLIDES[1], 1)
  })

  it('has one dot per slide, as buttons outside the scroller, the first current', () => {
    view.render(<RingCarousel slides={SLIDES} />)
    expect(dots().map(d => d.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
    expect(dots().map(d => d.getAttribute('aria-label'))).toEqual(['Page 1 of 4', 'Page 2 of 4', 'Page 3 of 4', 'Page 4 of 4'])
    expect(dots().every(d => !q('.g-rc').contains(d))).toBe(true)
    expect(dots().every(d => d.getAttribute('tabindex') !== '-1')).toBe(true)
    expect(activeDot()).toBe(0)
  })

  it('has no dots for a single ring', () => {
    view.render(<RingCarousel slides={[SLIDES[0]]} />)
    expect(dots()).toHaveLength(0)
  })

  it('follows a swipe and reports each page it settles on', () => {
    const onChange = vi.fn()
    view.render(<RingCarousel slides={SLIDES} onChange={onChange} />)
    scrollToPage(1)
    expect(activeDot()).toBe(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith(1)
    // more scrolling within the page is no change
    act(() => { q('.g-rc').scrollLeft = WIDTH + 20; q('.g-rc').dispatchEvent(new Event('scroll')) })
    expect(onChange).toHaveBeenCalledTimes(1)
    scrollToPage(0)
    expect(onChange).toHaveBeenLastCalledWith(0)
    expect(activeDot()).toBe(0)
  })

  it('scrolls to the page of a dot, and reports it once it gets there, not the pages on the way', () => {
    const onChange = vi.fn()
    view.render(<RingCarousel slides={SLIDES} onChange={onChange} />)
    click(dots()[3])
    expect(scrollTo).toHaveBeenCalledWith({ left: 3 * WIDTH, behavior: 'smooth' })
    scrollToPage(1)
    scrollToPage(2)
    expect(onChange).not.toHaveBeenCalled()
    scrollToPage(3)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(3)
    expect(activeDot()).toBe(3)
  })

  it('jumps instead of gliding under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduce'
    view.render(<RingCarousel slides={SLIDES} />)
    click(dots()[2])
    expect(scrollTo).toHaveBeenCalledWith({ left: 2 * WIDTH, behavior: 'auto' })
  })

  it('does nothing for the dot of the page already shown', () => {
    view.render(<RingCarousel slides={SLIDES} />)
    click(dots()[0])
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('starts on the page given, scrolled there and its dot current', () => {
    view.render(<RingCarousel slides={SLIDES} start={2} />)
    expect(q('.g-rc').scrollLeft).toBe(2 * WIDTH)
    expect(activeDot()).toBe(2)
  })

  it('clamps a start past the last page', () => {
    view.render(<RingCarousel slides={SLIDES} start={9} />)
    expect(activeDot()).toBe(3)
  })

  it('stays on a page that exists when a slide goes away', () => {
    view.render(<RingCarousel slides={SLIDES} start={3} />)
    view.render(<RingCarousel slides={SLIDES.slice(0, 2)} start={3} />)
    expect(activeDot()).toBe(1)
  })

  it('draws the skeleton: a ring, a pill and four dots, nothing to press', () => {
    view.render(<RingCarousel loading />)
    expect(q('[role="group"]').getAttribute('aria-busy')).toBe('true')
    expect(q('.g-sring').getAttribute('aria-hidden')).toBe('true')
    expect(q('.g-rc-sk-pill')).not.toBeNull()
    expect(qa('.g-rc-dot')).toHaveLength(4)
    expect(qa('.g-rc-dot.on, .g-rc-dot i.on')).toHaveLength(1)
    expect(view.host.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('sizes the skeleton dots by the slides it would show', () => {
    view.render(<RingCarousel loading slides={SLIDES.slice(0, 2)} />)
    expect(qa('.g-rc-dot')).toHaveLength(2)
  })
})
