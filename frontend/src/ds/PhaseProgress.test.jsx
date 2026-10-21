// @vitest-environment happy-dom
// PhaseProgress (boards W1.0, W1.32, W1.44, W1.9): the open phase as segments, the others folded
// into pills, the whole bar one control named by the caller.
import { describe, expect, it, vi } from 'vitest'
import PhaseProgress from './PhaseProgress.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const warm = state => ({ tone: 'warm', count: 3, state, name: 'Warm-up' })
const main = (state, count = 6) => ({ tone: 'main', count, state, name: 'Workout' })
const cool = state => ({ tone: 'cool', count: 3, state, name: 'Cool-down' })
const segs = () => [...view.host.querySelectorAll('.g-pp-seg')]
const pills = () => [...view.host.querySelectorAll('.g-pp-pill')]

describe('PhaseProgress', () => {
  it('draws the open phase as a segment per exercise and folds the others into pills', () => {
    view.render(<PhaseProgress phases={[warm('done'), main('now'), cool('waiting')]} index={2} done={2} label="All exercises" />)
    expect(segs()).toHaveLength(6)
    expect(pills()).toHaveLength(2)
    expect(view.host.querySelector('.g-pp-run').classList.contains('g-pp-main')).toBe(true)
  })

  it('a done phase is a pill with a check, a waiting one its count', () => {
    view.render(<PhaseProgress phases={[warm('done'), main('now'), cool('waiting')]} label="All exercises" />)
    const [first, last] = pills()
    expect(first.classList.contains('g-pp-done')).toBe(true)
    expect(first.querySelector('svg')).not.toBeNull()
    expect(first.getAttribute('title')).toBe('Warm-up')
    expect(first.classList.contains('g-pp-warm')).toBe(true)
    expect(last.classList.contains('g-pp-done')).toBe(false)
    expect(last.textContent).toBe('3')
    expect(last.classList.contains('g-pp-cool')).toBe(true)
  })

  it('writes the count as the caller gives it', () => {
    view.render(<PhaseProgress phases={[main('now'), { ...cool('waiting'), countLabel: '٣' }]} label="x" />)
    expect(pills()[0].textContent).toBe('٣')
  })

  it('marks the segments done, the one being worked and how far through it is', () => {
    view.render(<PhaseProgress phases={[main('now')]} index={2} done={2} partial={0.4} label="x" />)
    const all = segs()
    expect(all.map(s => s.classList.contains('g-pp-seg-done'))).toEqual([true, true, false, false, false, false])
    expect(all.map(s => s.classList.contains('g-pp-cur'))).toEqual([false, false, true, false, false, false])
    expect(all[2].style.getPropertyValue('--fill')).toBe('40%')
    expect(all[3].style.getPropertyValue('--fill')).toBe('')
  })

  it('keeps the fill between 0 and 100%', () => {
    view.render(<PhaseProgress phases={[main('now')]} index={0} done={0} partial={3} label="x" />)
    expect(segs()[0].style.getPropertyValue('--fill')).toBe('100%')
    view.render(<PhaseProgress phases={[main('now')]} index={0} done={0} partial={-1} label="x" />)
    expect(segs()[0].style.getPropertyValue('--fill')).toBe('0%')
  })

  it('thins the gaps of a long phase and not of a short one', () => {
    view.render(<PhaseProgress phases={[main('now', 14)]} label="x" />)
    expect(view.host.querySelector('.g-pp-run').classList.contains('g-pp-long')).toBe(true)
    view.render(<PhaseProgress phases={[main('now', 6)]} label="x" />)
    expect(view.host.querySelector('.g-pp-run').classList.contains('g-pp-long')).toBe(false)
  })

  it('does not draw a phase with count 0, and nothing at all without phases', () => {
    view.render(<PhaseProgress phases={[{ ...warm('done'), count: 0 }, main('now'), { ...cool('waiting'), count: 0 }]} label="x" />)
    expect(pills()).toHaveLength(0)
    expect(segs()).toHaveLength(6)
    view.render(<PhaseProgress phases={[{ ...main('now'), count: 0 }]} label="x" />)
    expect(view.host.querySelector('.g-pp')).toBeNull()
    view.render(<PhaseProgress label="x" />)
    expect(view.host.querySelector('.g-pp')).toBeNull()
  })

  it('is one control named by the caller, a button or a link, that opens the map', () => {
    const onOpen = vi.fn()
    view.render(<PhaseProgress phases={[main('now')]} label="Toutes les séries" onOpen={onOpen} />)
    const bar = view.host.querySelector('.g-pp')
    expect(bar.tagName).toBe('BUTTON')
    expect(bar.getAttribute('aria-label')).toBe('Toutes les séries')
    click(bar)
    expect(onOpen).toHaveBeenCalledTimes(1)
    view.render(<PhaseProgress phases={[main('now')]} label="x" href="#/map" />)
    expect(view.host.querySelector('.g-pp').tagName).toBe('A')
  })

  it('rejects an unknown tone while developing', () => {
    expect(() => view.render(<PhaseProgress phases={[{ tone: 'hot', count: 2, state: 'now' }]} label="x" />)).toThrow()
  })

  it('rejects an unknown state while developing', () => {
    expect(() => view.render(<PhaseProgress phases={[{ tone: 'main', count: 2, state: 'late' }]} label="x" />)).toThrow()
  })
})
