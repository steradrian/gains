// @vitest-environment happy-dom
// RoutineTiles (board T2.0): glass tiles in a sideways row, each opening its routine, with an
// optional play button that starts it.
import { describe, expect, it, vi } from 'vitest'
import RoutineTiles from './RoutineTiles.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tiles = () => [...view.host.querySelectorAll('.g-rtile')]

describe('RoutineTiles', () => {
  it('a named list of tiles: the stack (at most three), the name and the line', () => {
    view.render(<RoutineTiles label="Routines" items={[{ key: 'a', title: 'Push A', sub: '6 exercises · Sun', thumbs: ['a.webp', null, 'c.webp', 'd.webp'], onClick: () => {} }]} />)
    const list = view.host.querySelector('ul.g-rtiles')
    expect(list.getAttribute('aria-label')).toBe('Routines')
    const [tile] = tiles()
    expect(tile.classList.contains('g-glass')).toBe(true)
    expect(tile.querySelectorAll('.g-rtile-stack > span')).toHaveLength(3)
    expect(tile.querySelectorAll('.g-rtile-stack img')).toHaveLength(2)
    expect(tile.querySelector('.g-rtile-stack i svg')).not.toBeNull()
    expect(tile.querySelector('.g-rtile-open b').textContent).toBe('Push A')
    expect(tile.textContent).toContain('6 exercises · Sun')
  })

  it('the tile opens, the play button starts, each on its own', () => {
    const open = vi.fn(), start = vi.fn()
    view.render(<RoutineTiles items={[{ title: 'Push A', thumbs: [], onClick: open, play: { label: 'Start Push A', onClick: start } }]} />)
    const play = view.host.querySelector('.g-rtile-play')
    expect(play.getAttribute('aria-label')).toBe('Start Push A')
    click(play)
    expect(start).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    click(view.host.querySelector('.g-rtile-open'))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('an outlined tile with an icon disc (Freestyle), and a link with href', () => {
    view.render(<RoutineTiles items={[{ title: 'Freestyle', sub: 'Pick exercises as you go', icon: 'dumbbell', outline: true, href: '#/x' }]} />)
    const [tile] = tiles()
    expect(tile.classList.contains('g-rtile-line')).toBe(true)
    expect(tile.classList.contains('g-glass')).toBe(false)
    expect(tile.querySelector('.g-rtile-ic svg')).not.toBeNull()
    expect(tile.querySelector('a.g-rtile-open').getAttribute('href')).toBe('#/x')
    expect(tile.querySelector('.g-rtile-play')).toBeNull()
  })
})
