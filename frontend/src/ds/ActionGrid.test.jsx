// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import ActionGrid from './ActionGrid.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tiles = () => [...view.host.querySelectorAll('.g-atile')]

describe('ActionGrid', () => {
  it('draws a tile a item, icon over label, four across by default', () => {
    const onFood = vi.fn()
    view.render(<ActionGrid items={[{ icon: 'utensils', label: 'Log food', onClick: onFood, accent: true }, { icon: 'droplet', label: 'Water', ariaLabel: 'Add 250 ml of water' }]} />)
    expect(view.host.querySelector('.g-agrid').classList.contains('g-agrid-lg')).toBe(false)
    expect(tiles().map(b => b.textContent)).toEqual(['Log food', 'Water'])
    expect(tiles()[0].classList.contains('g-atile-accent')).toBe(true)
    expect(tiles()[0].querySelector('.g-icon')).not.toBeNull()
    expect(tiles()[1].getAttribute('aria-label')).toBe('Add 250 ml of water')
    click(tiles()[0])
    expect(onFood).toHaveBeenCalledOnce()
  })

  it('lg is three across (board T18Add), with a detail line, a link, and a busy tile that takes no tap', () => {
    const onWater = vi.fn()
    view.render(<ActionGrid size="lg" items={[
      { icon: 'play', label: 'Resume workout', detail: '12:04' },
      { icon: 'droplet', label: 'Water', onClick: onWater, disabled: true },
      { icon: 'history', label: 'Log activity', href: '#/train/history' },
    ]} />)
    expect(view.host.querySelector('.g-agrid').classList.contains('g-agrid-lg')).toBe(true)
    expect(tiles()[0].querySelector('.g-atile-detail').textContent).toBe('12:04')
    expect(tiles()[1].disabled).toBe(true)
    click(tiles()[1])
    expect(onWater).not.toHaveBeenCalled()
    expect(tiles()[2].tagName).toBe('A')
  })
})
