// @vitest-environment happy-dom
// StatTiles: two or three tiles of label, value and an optional line. The kit formats nothing.
import { describe, expect, it } from 'vitest'
import StatTiles from './StatTiles.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const tiles = () => [...view.host.querySelectorAll('.g-stat')]

describe('StatTiles', () => {
  it('draws a tile per item with the label, the value and the line as the caller wrote them', () => {
    view.render(<StatTiles items={[
      { label: 'Workouts', value: '24' },
      { label: 'Time', value: '14 h 20', sub: '+2 h on last month', tone: 'positive' },
    ]} />)
    expect(tiles()).toHaveLength(2)
    expect(tiles()[0].textContent).toBe('Workouts24')
    expect(tiles()[1].textContent).toBe('Time14 h 20+2 h on last month')
    expect(tiles()[1].querySelector('.g-pos').textContent).toBe('+2 h on last month')
    expect(tiles()[0].querySelector('.g-pos')).toBeNull()
  })

  it('has as many columns as items, up to three', () => {
    const items = n => Array.from({ length: n }, (_, i) => ({ label: 'L' + i, value: String(i) }))
    view.render(<StatTiles items={items(2)} />)
    expect(view.host.firstElementChild.classList.contains('g-stats-2')).toBe(true)
    view.render(<StatTiles items={items(3)} />)
    expect(view.host.firstElementChild.classList.contains('g-stats-3')).toBe(true)
    view.render(<StatTiles items={items(5)} />)
    expect(view.host.firstElementChild.classList.contains('g-stats-3')).toBe(true)
  })

  it('is light by default, glass on the stage, and refuses another tone', () => {
    view.render(<StatTiles items={[{ label: 'a', value: '1' }]} />)
    expect(view.host.firstElementChild.classList.contains('g-stats-stage')).toBe(false)
    view.render(<StatTiles tone="stage" items={[{ label: 'a', value: '1' }]} />)
    expect(view.host.firstElementChild.classList.contains('g-stats-stage')).toBe(true)
    expect(() => view.render(<StatTiles tone="dark" items={[]} />)).toThrow(/tone="dark"/)
  })
})
