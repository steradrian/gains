// @vitest-environment happy-dom
// StatTiles: a tile per item with its label, value and optional line; the stage tone; the columns.
import { describe, expect, it } from 'vitest'
import StatTiles from './StatTiles.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const ITEMS = [
  { key: 'streak', label: 'Streak', value: '6 weeks', sub: 'in a row · best 8' },
  { key: 'weight', label: 'Weight', value: '−0.3 kg', sub: '81.7 → 81.4 kg', tone: 'positive' },
  { key: 'volume', label: 'Volume', value: '–' },
]
const tiles = () => [...view.host.querySelectorAll('.g-stat')]

describe('StatTiles', () => {
  it('draws each tile, its line only when it has one', () => {
    view.render(<StatTiles items={ITEMS} />)
    expect(tiles().map(s => s.querySelector('span').textContent)).toEqual(['Streak', 'Weight', 'Volume'])
    expect(tiles().map(s => s.querySelector('b').textContent)).toEqual(['6 weeks', '−0.3 kg', '–'])
    expect(tiles().map(s => s.querySelectorAll('span').length)).toEqual([2, 2, 1])
    expect(tiles()[1].querySelector('.g-pos').textContent).toBe('81.7 → 81.4 kg')
    expect(view.host.querySelector('.g-stats').classList.contains('g-stats-c3')).toBe(true)
    expect(view.host.querySelector('.g-stats-stage')).toBeNull()
    expect(tiles().some(s => s.classList.contains('g-glass'))).toBe(false)
  })

  it('on the stage, in the columns asked for, by class and with no inline style', () => {
    view.render(<StatTiles items={ITEMS} tone="stage" columns={2} />)
    const grid = view.host.querySelector('.g-stats')
    expect(grid.classList.contains('g-stats-stage')).toBe(true)
    expect(grid.classList.contains('g-stats-c2')).toBe(true)
    expect(grid.getAttribute('style')).toBeNull()
    expect(tiles().every(s => s.classList.contains('g-glass'))).toBe(true)
  })

  it('has as many columns as items, up to three, and refuses another tone', () => {
    const items = n => Array.from({ length: n }, (_, i) => ({ label: 'L' + i, value: String(i) }))
    const cols = () => view.host.firstElementChild.classList
    view.render(<StatTiles items={items(2)} />)
    expect(cols().contains('g-stats-c2')).toBe(true)
    view.render(<StatTiles items={items(5)} />)
    expect(cols().contains('g-stats-c3')).toBe(true)
    expect(() => view.render(<StatTiles tone="dark" items={[]} />)).toThrow(/tone="dark"/)
  })
})
