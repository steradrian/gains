// @vitest-environment happy-dom
// MapRow: one exercise in the workout map. The still, the name and a line, where it stands (a
// tick, the "Set 2 of 3" pill, an empty ring), the superset bracket, the phase dot, and the drag
// handle: a button of its own that moves the row with the arrows and starts a drag on a press.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import MapRow from './MapRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.querySelector('.g-mr')
const main = () => view.host.querySelector('.g-mr-main')
const grip = () => view.host.querySelector('.g-mr-grip')
const key = (el, k) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })) })
const press = (el, init) => act(() => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...init })) })

describe('MapRow', () => {
  it('shows the still, the name and the line under it', () => {
    view.render(<MapRow image="/ex/bench.png" name="Bench press" sub="80 × 8 · 8 · 8" onClick={() => {}} />)
    expect(view.host.querySelector('img').getAttribute('src')).toBe('/ex/bench.png')
    expect(view.host.querySelector('img').getAttribute('alt')).toBe('')
    expect(view.host.querySelector('.g-mr-b b').textContent).toBe('Bench press')
    expect(view.host.querySelector('.g-mr-b span').textContent).toBe('80 × 8 · 8 · 8')
  })

  it('stands a dumbbell tile in for a missing still, and draws no line when there is none', () => {
    view.render(<MapRow name="Plank" />)
    expect(view.host.querySelector('img')).toBeNull()
    expect(view.host.querySelector('.g-mr-ph svg')).not.toBeNull()
    expect(view.host.querySelector('.g-mr-b span')).toBeNull()
  })

  it('done is a tick, now is the caller\'s pill and tints the row, todo is an empty ring', () => {
    view.render(<MapRow name="Bench press" state="done" stateLabel="Done" />)
    expect(view.host.querySelector('.g-mr-done svg')).not.toBeNull()
    expect(view.host.querySelector('.g-mr-done .g-sr').textContent).toBe('Done')
    expect(row().classList.contains('g-mr-cur')).toBe(false)
    view.render(<MapRow name="Cable fly" state="now" nowLabel="Set 2 of 3" />)
    expect(view.host.querySelector('.g-mr-now').textContent).toBe('Set 2 of 3')
    expect(row().classList.contains('g-mr-cur')).toBe(true)
    view.render(<MapRow name="Pushdown" stateLabel="Up next" />)
    expect(view.host.querySelector('.g-mr-todo')).not.toBeNull()
    expect(view.host.querySelector('.g-mr-todo .g-sr').textContent).toBe('Up next')
  })

  it('opens with onClick (a button) or href (a link), and is plain text with neither', () => {
    const onClick = vi.fn()
    view.render(<MapRow name="Plank" onClick={onClick} />)
    expect(main().tagName).toBe('BUTTON')
    click(main())
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<MapRow name="Plank" href="#/ex/1" />)
    expect(main().tagName).toBe('A')
    expect(main().getAttribute('href')).toBe('#/ex/1')
    view.render(<MapRow name="Plank" />)
    expect(main().tagName).toBe('DIV')
  })

  it('draws the superset bracket by half: a from the middle down, b down to the middle', () => {
    view.render(<MapRow name="Lateral raise" superset="a" />)
    expect(row().classList.contains('g-mr-ss-a')).toBe(true)
    expect(view.host.querySelector('.g-mr-br')).not.toBeNull()
    view.render(<MapRow name="Pushdown" superset="b" />)
    expect(row().classList.contains('g-mr-ss-b')).toBe(true)
    view.render(<MapRow name="Bench press" />)
    expect(view.host.querySelector('.g-mr-br')).toBeNull()
  })

  it('draws the phase dot for warm and cool rows, and none for the workout itself', () => {
    view.render(<MapRow name="Glute bridge" tone="warm" />)
    expect(view.host.querySelector('.g-mr-dot-warm')).not.toBeNull()
    view.render(<MapRow name="Couch stretch" tone="cool" />)
    expect(view.host.querySelector('.g-mr-dot-cool')).not.toBeNull()
    view.render(<MapRow name="Bench press" tone="main" />)
    expect(view.host.querySelector('.g-mr-dot')).toBeNull()
  })

  it('has no handle unless asked; the handle is a button of its own, named by the caller', () => {
    view.render(<MapRow name="Bench press" onClick={() => {}} />)
    expect(grip()).toBeNull()
    view.render(<MapRow name="Bench press" onClick={() => {}} handle handleLabel="Move Bench press" />)
    expect(grip().tagName).toBe('BUTTON')
    expect(grip().getAttribute('aria-label')).toBe('Move Bench press')
    // a sibling of the row's own button, never inside it
    expect(grip().closest('.g-mr-main')).toBeNull()
    expect(grip().hasAttribute('data-nodrag')).toBe(true)
  })

  it('the handle moves the row with Arrow Up and Down, and ignores other keys', () => {
    const onMove = vi.fn()
    view.render(<MapRow name="Bench press" handle handleLabel="Move Bench press" onMove={onMove} />)
    key(grip(), 'ArrowDown')
    expect(onMove).toHaveBeenLastCalledWith(1)
    key(grip(), 'ArrowUp')
    expect(onMove).toHaveBeenLastCalledWith(-1)
    key(grip(), 'ArrowLeft')
    key(grip(), 'Enter')
    expect(onMove).toHaveBeenCalledTimes(2)
  })

  it('a key on the handle does not open the row, and a tap on the handle does not either', () => {
    const onClick = vi.fn()
    view.render(<MapRow name="Bench press" onClick={onClick} handle handleLabel="Move" onMove={() => {}} />)
    key(grip(), 'ArrowDown')
    click(grip())
    expect(onClick).not.toHaveBeenCalled()
  })

  it('a press on the handle starts a drag with the event; a right-click of the mouse does not', () => {
    const onDragStart = vi.fn()
    view.render(<MapRow name="Bench press" handle handleLabel="Move" onDragStart={onDragStart} />)
    press(grip(), { pointerType: 'touch', clientY: 120 })
    expect(onDragStart).toHaveBeenCalledTimes(1)
    expect(onDragStart.mock.calls[0][0].clientY).toBe(120)
    press(grip(), { pointerType: 'mouse', button: 2 })
    expect(onDragStart).toHaveBeenCalledTimes(1)
    press(grip(), { pointerType: 'mouse', button: 0 })
    expect(onDragStart).toHaveBeenCalledTimes(2)
  })

  it('a lifted row says so in its class', () => {
    view.render(<MapRow name="Bench press" lifted />)
    expect(row().classList.contains('g-mr-lifted')).toBe(true)
    view.render(<MapRow name="Bench press" />)
    expect(row().classList.contains('g-mr-lifted')).toBe(false)
  })
})
