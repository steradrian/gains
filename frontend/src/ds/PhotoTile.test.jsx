// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import PhotoTile from './PhotoTile.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('PhotoTile', () => {
  it('shows the picture, the day and the weight, and opens on tap', () => {
    const onClick = vi.fn()
    view.render(<PhotoTile image={<img src="x.jpg" alt="" />} date="Sun 18 Oct" caption="81.4 kg" label="Sun 18 Oct · 81.4 kg" onClick={onClick} />)
    const tile = view.host.querySelector('button.g-ptile')
    expect(tile.getAttribute('aria-label')).toBe('Sun 18 Oct · 81.4 kg')
    expect(tile.querySelector('.g-ptile-img img').getAttribute('src')).toBe('x.jpg')
    expect(tile.querySelector('.g-ptile-date').textContent).toBe('Sun 18 Oct')
    expect(tile.querySelector('.g-ptile-cap').textContent).toBe('81.4 kg')
    click(tile)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('leaves the weight line out without a caption', () => {
    view.render(<PhotoTile image={null} date="Sun 18 Oct" label="Sun 18 Oct" onClick={() => {}} />)
    expect(view.host.querySelector('.g-ptile-cap')).toBeNull()
  })

  it('says the file is elsewhere instead of drawing a picture', () => {
    view.render(<PhotoTile image={<img src="x.jpg" alt="" />} date="Sun 4 Oct" missing missingLabel="On another phone" label="Sun 4 Oct" onClick={() => {}} />)
    const tile = view.host.querySelector('button.g-ptile')
    expect(tile.className).toContain('g-ptile-missing')
    expect(tile.querySelector('.g-ptile-gone').textContent).toBe('On another phone')
    expect(tile.querySelector('img')).toBeNull()
  })
})
