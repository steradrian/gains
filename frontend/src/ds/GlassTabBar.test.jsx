// @vitest-environment happy-dom
// GlassTabBar: Today · Train · + · Eat · Me, the lit tab on a pill that glides between slots (never
// onto the +), the running dot on Train, the + as its own button; controlled or on its own.
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GlassTabBar from './GlassTabBar.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)
const tabs = () => [...view.host.querySelectorAll('.g-tab')]
const plus = () => q('.g-plus')
const ind = () => q('.g-tab-ind')
const slot = () => ind().style.getPropertyValue('--i')

let frames
beforeEach(() => {
  // Frames run only when a test says so: what the first paint looks like stays observable.
  frames = []
  window.requestAnimationFrame = vi.fn(cb => { frames.push(cb); return frames.length })
  window.cancelAnimationFrame = vi.fn()
})
const runFrames = () => act(() => { const due = frames; frames = []; due.forEach(cb => cb()) })

describe('GlassTabBar', () => {
  it('is Today · Train · + · Eat · Me, in a named navigation', () => {
    view.render(<GlassTabBar />)
    expect(q('nav').getAttribute('aria-label')).toBe('Main navigation')
    expect(tabs().map(b => b.textContent)).toEqual(['Today', 'Train', 'Eat', 'Me'])
    expect(tabs().map(b => b.querySelector('[data-icon]').getAttribute('data-icon'))).toEqual(['house', 'dumbbell', 'eat', 'user'])
    const kids = [...q('nav').children].filter(el => el !== ind())
    expect(kids.indexOf(plus())).toBe(2)
    expect(plus().getAttribute('aria-label')).toBe('Add to Today')
    expect(plus().getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('lights the current tab, and none for null', () => {
    view.render(<GlassTabBar current="eat" onChange={() => {}} />)
    expect(tabs().map(b => b.getAttribute('aria-current'))).toEqual([null, null, 'page', null])
    view.render(<GlassTabBar current={null} onChange={() => {}} />)
    expect(tabs().every(b => !b.getAttribute('aria-current'))).toBe(true)
  })

  it('controlled, reports every tap and lights only what it is given', () => {
    const onChange = vi.fn()
    view.render(<GlassTabBar current="today" onChange={onChange} />)
    click(tabs()[3])
    click(tabs()[0])
    expect(onChange.mock.calls).toEqual([['me'], ['today']])
    expect(tabs()[0].getAttribute('aria-current')).toBe('page')
  })

  it('on its own, lights what is tapped', () => {
    view.render(<GlassTabBar />)
    click(tabs()[1])
    expect(tabs()[1].getAttribute('aria-current')).toBe('page')
  })

  it('calls onPlus from the +, which is never lit', () => {
    const onPlus = vi.fn()
    view.render(<GlassTabBar onPlus={onPlus} />)
    click(plus())
    expect(onPlus).toHaveBeenCalledOnce()
    expect(plus().hasAttribute('aria-current')).toBe(false)
  })

  it('shows the dot on Train while a workout runs, and says so in its name', () => {
    view.render(<GlassTabBar />)
    expect(q('.g-tab-dot')).toBeNull()
    view.render(<GlassTabBar running />)
    expect(tabs()[1].querySelector('.g-tab-dot')).not.toBeNull()
    expect(tabs()[1].getAttribute('aria-label')).toBe('Train, workout in progress')
  })

  it('makes links of the tabs and the + with hrefs', () => {
    view.render(<GlassTabBar hrefs={{ today: '#/home', train: '#/train', eat: '#/food', me: '#/progress', plus: '#/add' }} />)
    expect(tabs().map(a => a.getAttribute('href'))).toEqual(['#/home', '#/train', '#/food', '#/progress'])
    expect(plus().tagName).toBe('A')
    expect(plus().getAttribute('href')).toBe('#/add')
  })

  it('keeps the very same buttons across a re-render', () => {
    view.render(<GlassTabBar current="today" onChange={() => {}} />)
    const before = tabs()
    view.render(<GlassTabBar current="today" onChange={() => {}} running />)
    tabs().forEach((el, i) => expect(el).toBe(before[i]))
  })
})

describe('the pill', () => {
  it('maps the four tabs onto the five slots, skipping the +', () => {
    const want = { today: '0', train: '1', eat: '3', me: '4' }
    for (const [current, s] of Object.entries(want)) {
      view.render(<GlassTabBar current={current} onChange={() => {}} />)
      expect(slot(), current).toBe(s)
    }
  })

  it('does not glide on its first paint, only once two frames have gone by', () => {
    view.render(<GlassTabBar current="eat" onChange={() => {}} />)
    expect(ind().className).toBe('g-tab-ind')
    runFrames()
    expect(ind().className).toBe('g-tab-ind')
    runFrames()
    expect(ind().className).toBe('g-tab-ind g-tab-ind-ready')
  })

  it('with no tab lit fades out where it is, and comes back from there', () => {
    view.render(<GlassTabBar current="me" onChange={() => {}} />)
    view.render(<GlassTabBar current={null} onChange={() => {}} />)
    expect(ind().classList.contains('g-tab-ind-off')).toBe(true)
    expect(slot()).toBe('4')
    view.render(<GlassTabBar current="me" onChange={() => {}} />)
    expect(ind().classList.contains('g-tab-ind-off')).toBe(false)
    expect(slot()).toBe('4')
  })

  it('is decorative', () => {
    view.render(<GlassTabBar />)
    expect(ind().getAttribute('aria-hidden')).toBe('true')
  })
})
