// @vitest-environment happy-dom
// ExerciseHero (boards W1.2, W1.32, W1.36, W1.41) and WorkoutThumb: the picture, the name, the dots,
// ⋯, the eyebrow and the pinned note, and a sideways swipe as a shortcut for the footer's ‹ ›.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import ExerciseHero from './ExerciseHero.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const pic = () => view.host.querySelector('.g-xh-pic')
const more = () => view.host.querySelector('.g-xh-more')
const hero = (props = {}) => (
  <ExerciseHero
    image="data:image/svg+xml,x" name="Bench press" meta="Barbell · 3 × 8 · 2:00 rest"
    howLabel="Bench press, how to" moreLabel="Bench press, options" {...props}
  />
)

function pointer(el, type, x, y = 0) {
  act(() => {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'touch' }))
  })
}
const swipe = (el, from, to, dy = 0) => {
  pointer(el, 'pointerdown', from, 0)
  pointer(el, 'pointermove', (from + to) / 2, dy / 2)
  pointer(el, 'pointerup', to, dy)
}

describe('ExerciseHero', () => {
  it('draws the name, the meta line and the eyebrow', () => {
    view.render(hero({ part: 'Workout · 1 of 6' }))
    expect(view.host.querySelector('.g-xh-name').textContent).toBe('Bench press')
    expect(view.host.querySelector('.g-xh-meta').textContent).toBe('Barbell · 3 × 8 · 2:00 rest')
    expect(view.host.querySelector('.g-xh-part').textContent).toBe('Workout · 1 of 6')
  })

  it('names the picture and ⋯ with the caller\'s words, and calls onHow and onMore', () => {
    const onHow = vi.fn()
    const onMore = vi.fn()
    view.render(hero({ howLabel: 'Développé couché, comment faire', moreLabel: 'Développé couché, options', onHow, onMore }))
    expect(pic().getAttribute('aria-label')).toBe('Développé couché, comment faire')
    expect(more().getAttribute('aria-label')).toBe('Développé couché, options')
    click(pic())
    click(more())
    expect(onHow).toHaveBeenCalledTimes(1)
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it('the picture and ⋯ are links with an href', () => {
    view.render(hero({ howHref: '#/how', moreHref: '#/more' }))
    expect(pic().tagName).toBe('A')
    expect(more().tagName).toBe('A')
  })

  it('the picture is decorative: the control carries the name', () => {
    view.render(hero())
    expect(pic().querySelector('img').getAttribute('alt')).toBe('')
  })

  it('keeps the picture\'s place with an empty tile when there is no image', () => {
    view.render(hero({ image: undefined }))
    expect(pic().querySelector('img')).toBeNull()
    expect(pic().querySelector('.g-wkimg-lg')).not.toBeNull()
  })

  it('draws a dot per set, named as a whole when the caller names it, hidden when not', () => {
    view.render(hero({ dots: ['done', 'now', 'todo'], dotsLabel: 'Set 2 of 3' }))
    const dots = view.host.querySelector('.g-xh-dots')
    expect([...dots.children].map(d => d.className)).toEqual(['g-xh-dot g-xh-done', 'g-xh-dot g-xh-now', 'g-xh-dot g-xh-todo'])
    expect(dots.getAttribute('role')).toBe('img')
    expect(dots.getAttribute('aria-label')).toBe('Set 2 of 3')
    view.render(hero({ dots: ['done'] }))
    expect(view.host.querySelector('.g-xh-dots').getAttribute('aria-hidden')).toBe('true')
    view.render(hero())
    expect(view.host.querySelector('.g-xh-dots')).toBeNull()
  })

  it('the New to you tag says the caller\'s text and opens How to too', () => {
    const onHow = vi.fn()
    view.render(hero({ newToYou: true, newText: 'Nouveau pour vous · comment faire', onHow }))
    const tag = view.host.querySelector('.g-xh-new')
    expect(tag.textContent).toBe('Nouveau pour vous · comment faire')
    click(tag)
    expect(onHow).toHaveBeenCalledTimes(1)
    view.render(hero({ onHow }))
    expect(view.host.querySelector('.g-xh-new')).toBeNull()
  })

  it('pins the setup note when there is one', () => {
    view.render(hero({ note: 'Feet flat, shoulder blades back' }))
    expect(view.host.querySelector('.g-xh-note').textContent).toBe('Feet flat, shoulder blades back')
    view.render(hero())
    expect(view.host.querySelector('.g-xh-note')).toBeNull()
  })

  it('sets a long name a size smaller', () => {
    view.render(hero({ name: 'Kneeling hip flexor stretch' }))
    expect(view.host.querySelector('.g-xh-name').classList.contains('g-xh-long')).toBe(true)
    view.render(hero())
    expect(view.host.querySelector('.g-xh-name').classList.contains('g-xh-long')).toBe(false)
  })

  describe('swiping', () => {
    it('a drag left is next and a drag right previous', () => {
      const onSwipe = vi.fn()
      view.render(hero({ onSwipe }))
      const el = view.host.querySelector('.g-xh')
      swipe(el, 300, 200)
      expect(onSwipe).toHaveBeenLastCalledWith('next')
      swipe(el, 100, 220)
      expect(onSwipe).toHaveBeenLastCalledWith('prev')
      expect(onSwipe).toHaveBeenCalledTimes(2)
    })

    it('right to left, the directions swap', () => {
      const onSwipe = vi.fn()
      view.host.setAttribute('dir', 'rtl')
      view.render(hero({ onSwipe }))
      const el = view.host.querySelector('.g-xh')
      el.style.direction = 'rtl'
      swipe(el, 100, 220)
      expect(onSwipe).toHaveBeenLastCalledWith('next')
      swipe(el, 300, 200)
      expect(onSwipe).toHaveBeenLastCalledWith('prev')
      view.host.removeAttribute('dir')
    })

    it('a short drag, a mostly vertical one or a cancelled one does nothing', () => {
      const onSwipe = vi.fn()
      view.render(hero({ onSwipe }))
      const el = view.host.querySelector('.g-xh')
      swipe(el, 300, 280)
      swipe(el, 300, 240, 200)
      pointer(el, 'pointerdown', 300)
      pointer(el, 'pointercancel', 100)
      pointer(el, 'pointerup', 100)
      expect(onSwipe).not.toHaveBeenCalled()
    })

    it('without onSwipe a swipe is nothing and the hero is not marked as swipeable', () => {
      view.render(hero())
      const el = view.host.querySelector('.g-xh')
      expect(el.classList.contains('g-xh-swipe')).toBe(false)
      swipe(el, 300, 100)
    })

    it('the click that ends a swipe does not press the picture, and the next tap does', () => {
      const onHow = vi.fn()
      const onSwipe = vi.fn()
      view.render(hero({ onHow, onSwipe }))
      swipe(view.host.querySelector('.g-xh'), 300, 100)
      click(pic())
      expect(onHow).not.toHaveBeenCalled()
      click(pic())
      expect(onHow).toHaveBeenCalledTimes(1)
    })

    it('a tap with no swipe before it presses the picture', () => {
      const onHow = vi.fn()
      view.render(hero({ onHow, onSwipe: () => {} }))
      click(pic())
      expect(onHow).toHaveBeenCalledTimes(1)
    })
  })
})
