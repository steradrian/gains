// @vitest-environment happy-dom
// Dock: the floating bar above the tab bar. Planned (routine, a line, Start) or running (a live
// dot, the clock, Resume), the body one button that opens the workout, a countdown and a progress
// line along the top, the caller's buttons after it. Every word is the caller's.
import { describe, expect, it, vi } from 'vitest'
import Dock from './Dock.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const dock = () => view.host.querySelector('.g-dock')
const main = () => view.host.querySelector('.g-dock-main')
const btn = label => [...view.host.querySelectorAll('.g-btn')].find(b => b.textContent === label)

describe('Dock', () => {
  it('planned shows the routine and its line with a primary Start, and no live dot', () => {
    const onAction = vi.fn()
    view.render(<Dock state="planned" routine="Push A" meta="6 exercises" actionLabel="Start" onAction={onAction} />)
    expect(dock().classList.contains('g-dock-planned')).toBe(true)
    expect(view.host.querySelector('.g-dock-text b').textContent).toBe('Push A')
    expect(view.host.querySelector('.g-dock-meta').textContent).toBe('6 exercises')
    expect(view.host.querySelector('.g-dock-live')).toBeNull()
    expect(btn('Start').classList.contains('g-btn-primary')).toBe(true)
    expect(btn('Start').querySelector('svg')).not.toBeNull()
    click(btn('Start'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('is planned unless told it is running', () => {
    view.render(<Dock routine="Push A" meta="6 exercises" />)
    expect(dock().classList.contains('g-dock-planned')).toBe(true)
  })

  it('running shows the live dot and the clock, which can be a node, with a secondary Resume', () => {
    const onAction = vi.fn()
    view.render(<Dock state="running" routine="Push A" clock={<b className="tick">23:10</b>} meta="ignored" actionLabel="Resume" onAction={onAction} />)
    expect(dock().classList.contains('g-dock-running')).toBe(true)
    expect(view.host.querySelector('.g-dock-live')).not.toBeNull()
    expect(view.host.querySelector('.g-dock-clock .tick').textContent).toBe('23:10')
    expect(view.host.querySelector('.g-dock-meta')).toBeNull()
    expect(btn('Resume').classList.contains('g-btn-secondary')).toBe(true)
    click(btn('Resume'))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('has no button of its own unless it has a label for one', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(view.host.querySelectorAll('.g-btn')).toHaveLength(0)
    expect(view.host.querySelector('.g-dock-acts')).toBeNull()
  })

  it('the body is one button that opens the workout, read as the caller\'s openLabel first', () => {
    const onOpen = vi.fn()
    view.render(<Dock state="running" routine="Push A" clock="23:10" count="1:12" openLabel="Open workout" onOpen={onOpen} />)
    expect(main().tagName).toBe('BUTTON')
    expect(main().querySelector('.g-sr').textContent).toBe('Open workout')
    expect(main().textContent).toBe('Open workoutPush A23:101:12')
    expect(main().querySelector('.g-dock-count').textContent).toBe('1:12')
    click(main())
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('the body is a link with openHref, and plain text with neither', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" openHref="#/train/workout" />)
    expect(main().tagName).toBe('A')
    expect(main().getAttribute('href')).toBe('#/train/workout')
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(main().tagName).toBe('DIV')
  })

  it('draws the progress line by transform, kept between none and all', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" progress={0.6} />)
    const fill = () => view.host.querySelector('.g-dock-bar i')
    expect(fill().style.transform).toBe('scaleX(0.6)')
    view.render(<Dock state="running" routine="Push A" clock="23:10" progress={1.7} />)
    expect(fill().style.transform).toBe('scaleX(1)')
    view.render(<Dock state="running" routine="Push A" clock="23:10" progress={-1} />)
    expect(fill().style.transform).toBe('scaleX(0)')
    view.render(<Dock state="running" routine="Push A" clock="23:10" progress={0} />)
    expect(fill().style.transform).toBe('scaleX(0)')
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(view.host.querySelector('.g-dock-bar')).toBeNull()
  })

  it('puts the caller\'s buttons after the body, in a row of their own', () => {
    const onSkip = vi.fn()
    view.render(
      <Dock state="running" routine="Push A" clock="23:10" count="0:45" openLabel="Open workout" onOpen={() => {}}>
        <button type="button" aria-label="Add 30 seconds">30s</button>
        <button type="button" onClick={onSkip}>Skip</button>
      </Dock>,
    )
    const acts = view.host.querySelector('.g-dock-acts')
    expect(acts.parentElement).toBe(dock())
    expect(acts.previousElementSibling).toBe(main())
    expect([...acts.children].map(b => b.textContent)).toEqual(['30s', 'Skip'])
    expect(main().contains(acts)).toBe(false)
    click(acts.children[1])
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('a timed hold outlines the dock', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" hold />)
    expect(dock().classList.contains('g-dock-hold')).toBe(true)
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(dock().classList.contains('g-dock-hold')).toBe(false)
  })

  it('is a bar on the glass material', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(dock().getAttribute('data-glass')).toBe('bar')
  })

  it('is a landmark only when the caller names it', () => {
    view.render(<Dock state="running" routine="Push A" clock="23:10" label="Running workout" />)
    expect(dock().getAttribute('role')).toBe('region')
    expect(dock().getAttribute('aria-label')).toBe('Running workout')
    view.render(<Dock state="running" routine="Push A" clock="23:10" />)
    expect(dock().hasAttribute('role')).toBe(false)
  })
})
