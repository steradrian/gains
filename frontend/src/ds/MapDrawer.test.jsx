// @vitest-environment happy-dom
// MapDrawer: the workout map, the content of a full BottomSheet. Exercises by phase with their
// states, the superset bracket, a phase's own button, the pinned hint and foot. Reordering stays
// inside a phase: Arrow Up and Down on a handle move a row one place, and dragging one lifts it,
// opens a gap, and drops it once, never past its phase's first or last place.
import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MapDrawer from './MapDrawer.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
afterEach(() => { vi.restoreAllMocks() })

const row = (id, name, extra) => ({ id, name, sub: '3 × 10', handleLabel: 'Move ' + name, ...extra })
const sections = () => [
  { key: 'warm', title: 'Warm-up · done', tone: 'warm', rows: [row('a', 'Glute bridge', { state: 'done' }), row('b', 'Dead bug', { state: 'done' })] },
  { key: 'main', title: 'Workout', tone: 'main', rows: [row('c', 'Bench press', { state: 'done' }), row('d', 'Cable fly', { state: 'now', nowLabel: 'Set 2 of 3' }), row('e', 'Lateral raise', { superset: 'a' }), row('f', 'Pushdown', { superset: 'b' })] },
  { key: 'cool', title: 'Cool-down · 1', tone: 'cool', action: 'Skip cool-down', rows: [row('g', 'Couch stretch')] },
]
const grips = () => [...view.host.querySelectorAll('.g-mr-grip')]
const gripOf = name => view.host.querySelector(`.g-mr-grip[aria-label="Move ${name}"]`)
const items = () => [...view.host.querySelectorAll('.g-md-item')]
const names = () => items().map(i => i.querySelector('.g-mr-b b').textContent)
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })) })

describe('MapDrawer', () => {
  it('lists every phase with its title and its rows, in order', () => {
    view.render(<MapDrawer sections={sections()} />)
    const heads = [...view.host.querySelectorAll('[role="heading"]')]
    expect(heads.map(h => h.textContent)).toEqual(['Warm-up · done', 'Workout', 'Cool-down · 1'])
    expect(heads.every(h => h.getAttribute('aria-level') === '3')).toBe(true)
    expect(names()).toEqual(['Glute bridge', 'Dead bug', 'Bench press', 'Cable fly', 'Lateral raise', 'Pushdown', 'Couch stretch'])
    expect(view.host.querySelectorAll('.g-md-sec')).toHaveLength(3)
  })

  it('dots the warm and cool phases and their rows, and the workout has none', () => {
    view.render(<MapDrawer sections={sections()} />)
    expect(view.host.querySelectorAll('.g-md-dot-warm')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-md-dot-cool')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-mr-dot-warm')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-mr-dot-cool')).toHaveLength(1)
    expect(view.host.querySelectorAll('.g-mr-dot')).toHaveLength(3)
  })

  it('carries each row\'s state and the superset bracket through to its MapRow', () => {
    view.render(<MapDrawer sections={sections()} />)
    expect(view.host.querySelector('.g-mr-now').textContent).toBe('Set 2 of 3')
    expect(view.host.querySelectorAll('.g-mr-done')).toHaveLength(3)
    expect(view.host.querySelector('.g-mr-ss-a')).not.toBeNull()
    expect(view.host.querySelector('.g-mr-ss-b')).not.toBeNull()
  })

  it('a phase\'s own button is there with its words and calls its handler', () => {
    const onAction = vi.fn()
    const list = sections()
    list[2].onAction = onAction
    view.render(<MapDrawer sections={list} />)
    const skip = view.host.querySelector('.g-md-a')
    expect(skip.textContent).toBe('Skip cool-down')
    click(skip)
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(view.host.querySelectorAll('.g-md-a')).toHaveLength(1)
  })

  it('shows the hint, and the foot buttons only for the labels it is given', () => {
    const onAdd = vi.fn()
    const onSuperset = vi.fn()
    view.render(<MapDrawer sections={sections()} hint="Drag to reorder within a phase" addLabel="Add exercise" onAdd={onAdd}
      supersetLabel="Make superset" onSuperset={onSuperset} footer={<button type="button">Workout options</button>} />)
    expect(view.host.querySelector('.g-md-hint').textContent).toBe('Drag to reorder within a phase')
    const foot = [...view.host.querySelectorAll('.g-md-foot .g-btn')]
    expect(foot.map(b => b.textContent)).toEqual(['Add exercise', 'Make superset'])
    click(foot[0])
    click(foot[1])
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onSuperset).toHaveBeenCalledTimes(1)
    expect(view.host.querySelector('.g-md-more').textContent).toBe('Workout options')
    view.render(<MapDrawer sections={sections()} addLabel="Add exercise" />)
    expect([...view.host.querySelectorAll('.g-md-foot .g-btn')].map(b => b.textContent)).toEqual(['Add exercise'])
    view.render(<MapDrawer sections={sections()} />)
    expect(view.host.querySelector('.g-md-pin')).toBeNull()
    expect(view.host.querySelector('.g-md-hint')).toBeNull()
  })

  it('rows have a handle only when the drawer can reorder, and a row can opt out', () => {
    view.render(<MapDrawer sections={sections()} />)
    expect(grips()).toHaveLength(0)
    const list = sections()
    list[0].rows[0].handle = false
    view.render(<MapDrawer sections={list} onReorder={() => {}} />)
    expect(grips()).toHaveLength(6)
    expect(gripOf('Glute bridge')).toBeNull()
    expect(gripOf('Dead bug').getAttribute('aria-label')).toBe('Move Dead bug')
  })

  describe('with the keyboard', () => {
    it('Arrow Down and Up on a handle move the row one place inside its phase, and say so', () => {
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} movedLabel={(name, place, count) => `${name}, ${place} of ${count}`} />)
      key(gripOf('Cable fly'), 'ArrowDown')
      expect(onReorder).toHaveBeenLastCalledWith('main', 1, 2)
      expect(view.host.querySelector('[role="status"]').textContent).toBe('Cable fly, 3 of 4')
      key(gripOf('Cable fly'), 'ArrowUp')
      expect(onReorder).toHaveBeenLastCalledWith('main', 1, 0)
      expect(view.host.querySelector('[role="status"]').textContent).toBe('Cable fly, 1 of 4')
    })

    it('stops at the first and last place of a phase: nothing crosses into the next', () => {
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} />)
      key(gripOf('Dead bug'), 'ArrowDown')
      key(gripOf('Glute bridge'), 'ArrowUp')
      key(gripOf('Bench press'), 'ArrowUp')
      key(gripOf('Pushdown'), 'ArrowDown')
      key(gripOf('Couch stretch'), 'ArrowDown')
      key(gripOf('Couch stretch'), 'ArrowUp')
      expect(onReorder).not.toHaveBeenCalled()
    })

    it('says nothing out loud without a movedLabel', () => {
      view.render(<MapDrawer sections={sections()} onReorder={() => {}} />)
      key(gripOf('Bench press'), 'ArrowDown')
      expect(view.host.querySelector('[role="status"]').textContent).toBe('')
    })
  })

  describe('by dragging', () => {
    const H = 64
    const rect = (top, height) => ({ top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON() {} })
    // Every row is 64px tall and they stack from the top of their phase.
    const layout = () => vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function boxOf() {
      if (!this.classList.contains('g-md-item')) return rect(0, 0)
      const at = [...this.parentElement.children].filter(c => c.classList.contains('g-md-item')).indexOf(this)
      return rect(at * H, H)
    })
    const down = (el, y) => act(() => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', clientY: y })) })
    const to = (type, y) => act(() => { window.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientY: y })) })
    const held = () => view.host.querySelector('.g-md-held')

    it('lifts the row, opens a gap where it would land and drops it once, at the place it was dropped on', () => {
      layout()
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} />)
      down(gripOf('Bench press'), 100)
      expect(held().querySelector('.g-mr-b b').textContent).toBe('Bench press')
      expect(held().querySelector('.g-mr-lifted')).not.toBeNull()
      expect(view.host.querySelector('.g-md-slot')).not.toBeNull()
      to('pointermove', 100 + 2 * H - 10)
      // its bottom edge is past the middle of the second and third rows and not the fourth: it
      // would land third, and the two it passes step up out of its way
      expect(held().style.transform).toBe(`translateY(${2 * H - 10}px)`)
      expect(items()[3].style.transform).toBe(`translateY(${-H}px)`)
      expect(items()[4].style.transform).toBe(`translateY(${-H}px)`)
      expect(items()[5].style.transform).toBe('')
      expect(items()[1].style.transform).toBe('')
      expect(onReorder).not.toHaveBeenCalled()
      to('pointerup', 100 + 2 * H - 10)
      expect(onReorder).toHaveBeenCalledTimes(1)
      expect(onReorder).toHaveBeenCalledWith('main', 0, 2)
      expect(held()).toBeNull()
      expect(view.host.querySelector('.g-md-slot')).toBeNull()
    })

    it('a drag upward lands above the rows it passes', () => {
      layout()
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} />)
      down(gripOf('Pushdown'), 400)
      to('pointermove', 400 - 3 * H + 5)
      expect(held().style.transform).toBe(`translateY(${-3 * H + 5}px)`)
      expect(items()[2].style.transform).toBe(`translateY(${H}px)`)
      expect(items()[4].style.transform).toBe(`translateY(${H}px)`)
      expect(items()[1].style.transform).toBe('')
      to('pointerup', 400 - 3 * H + 5)
      expect(onReorder).toHaveBeenCalledWith('main', 3, 0)
    })

    it('never leaves its phase: dragged far past either end it stops at the first or last place of its own', () => {
      layout()
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} />)
      down(gripOf('Cable fly'), 200)
      to('pointermove', 200 + 5000)
      // four rows in the phase: the row can travel to the last place and no further
      expect(held().style.transform).toBe(`translateY(${(4 - 2) * H}px)`)
      to('pointerup', 200 + 5000)
      expect(onReorder).toHaveBeenCalledTimes(1)
      expect(onReorder).toHaveBeenLastCalledWith('main', 1, 3)

      down(gripOf('Dead bug'), 100)
      to('pointermove', 100 - 5000)
      expect(held().style.transform).toBe(`translateY(${-H}px)`)
      to('pointerup', 100 - 5000)
      expect(onReorder).toHaveBeenLastCalledWith('warm', 1, 0)
      // a phase of one cannot be dragged at all
      down(gripOf('Couch stretch'), 100)
      expect(held()).toBeNull()
      expect(onReorder).toHaveBeenCalledTimes(2)
    })

    it('letting go where it started reorders nothing, and so do Escape and a cancelled touch', () => {
      layout()
      const onReorder = vi.fn()
      view.render(<MapDrawer sections={sections()} onReorder={onReorder} />)
      down(gripOf('Bench press'), 100)
      to('pointermove', 110)
      to('pointerup', 110)
      expect(onReorder).not.toHaveBeenCalled()
      down(gripOf('Bench press'), 100)
      to('pointermove', 300)
      act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })) })
      expect(held()).toBeNull()
      to('pointerup', 300)
      down(gripOf('Bench press'), 100)
      to('pointermove', 300)
      to('pointercancel', 300)
      expect(held()).toBeNull()
      expect(onReorder).not.toHaveBeenCalled()
    })

    it('announces the drop, and a row moves in the list once the caller reorders it', () => {
      layout()
      const list = sections()
      const reorder = vi.fn()
      view.render(<MapDrawer sections={list} onReorder={reorder} movedLabel={(name, place, count) => `${name}, ${place} of ${count}`} />)
      down(gripOf('Bench press'), 100)
      to('pointermove', 100 + 2 * H)
      to('pointerup', 100 + 2 * H)
      expect(view.host.querySelector('[role="status"]').textContent).toBe('Bench press, 3 of 4')
      const moved = sections()
      moved[1].rows = [moved[1].rows[1], moved[1].rows[2], moved[1].rows[0], moved[1].rows[3]]
      view.render(<MapDrawer sections={moved} onReorder={reorder} />)
      expect(names().slice(2, 6)).toEqual(['Cable fly', 'Lateral raise', 'Bench press', 'Pushdown'])
    })
  })
})
