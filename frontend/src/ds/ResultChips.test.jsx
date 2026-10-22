// @vitest-environment happy-dom
// ResultChips: a count chip a kind, named with its words; tapping one scopes to it.
import { describe, expect, it, vi } from 'vitest'
import { summaryOf } from '../lib/search/results.js'
import ResultChips from './ResultChips.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const chips = () => [...view.host.querySelectorAll('.g-rchip')]
const many = n => Array.from({ length: n }, (_, i) => ({ key: String(i) }))
const ITEMS = summaryOf({ exercises: many(4), workouts: many(1200) }, ['exercises', 'workouts'])

describe('ResultChips', () => {
  it('draws the count bold before its noun, and names the chip with words and the locale\'s number', () => {
    view.render(<ResultChips items={ITEMS} />)
    expect(view.host.querySelector('nav').getAttribute('aria-label')).toBe('Results by kind')
    expect(chips()[0].querySelector('b').textContent).toBe('4')
    expect(chips()[0].querySelector('span').textContent).toBe('exercises')
    expect(chips()[1].querySelector('b').textContent).toBe('1,200')
    expect(chips()[1].querySelector('span').textContent).toBe('workouts')
    expect(chips()[0].getAttribute('aria-label')).toBe('4 exercises, show only these')
    expect(chips()[1].getAttribute('aria-label')).toBe('1,200 workouts, show only these')
  })

  it('takes the noun summaryOf gives, never one cut out of the text around the number', () => {
    view.render(<ResultChips items={[{ group: 'days', count: 3, text: 'Days: 3', noun: 'Days:' }]} />)
    expect(chips()[0].querySelector('span').textContent).toBe('Days:')
  })

  it('scopes on a tap, the one shown alone lit and pressed', () => {
    const onSelect = vi.fn()
    view.render(<ResultChips items={ITEMS} active="workouts" onSelect={onSelect} />)
    expect(chips().map(c => c.classList.contains('on'))).toEqual([false, true])
    expect(chips()[1].getAttribute('aria-pressed')).toBe('true')
    expect(chips()[0].classList.contains('g-glass')).toBe(true)
    click(chips()[0])
    expect(onSelect).toHaveBeenCalledWith('exercises')
  })

  it('draws every chip as flat glass, the lit one included', () => {
    view.render(<ResultChips items={ITEMS} active="workouts" />)
    expect(chips().map(c => c.dataset.glass)).toEqual(['flat', 'flat'])
  })

  it('draws nothing with no counts', () => {
    view.render(<ResultChips items={[]} />)
    expect(view.host.innerHTML).toBe('')
  })
})
