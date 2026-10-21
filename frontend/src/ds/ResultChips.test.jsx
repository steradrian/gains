// @vitest-environment happy-dom
// ResultChips: a count chip a kind, named with its words; tapping one scopes to it.
import { describe, expect, it, vi } from 'vitest'
import ResultChips from './ResultChips.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const chips = () => [...view.host.querySelectorAll('.g-rchip')]
const ITEMS = [{ group: 'exercises', count: 4, text: '4 exercises' }, { group: 'workouts', count: 1200, text: '1200 workouts' }]

describe('ResultChips', () => {
  it('draws the count bold before its noun, and names the chip with words', () => {
    view.render(<ResultChips items={ITEMS} />)
    expect(view.host.querySelector('nav').getAttribute('aria-label')).toBe('Results by kind')
    expect(chips()[0].querySelector('b').textContent).toBe('4')
    expect(chips()[0].querySelector('span').textContent).toBe('exercises')
    expect(chips()[1].querySelector('b').textContent).toBe('1,200')
    expect(chips()[0].getAttribute('aria-label')).toBe('4 exercises, show only these')
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

  it('draws nothing with no counts', () => {
    view.render(<ResultChips items={[]} />)
    expect(view.host.innerHTML).toBe('')
  })
})
