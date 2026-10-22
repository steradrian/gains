// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import PhotoGrid from './PhotoGrid.jsx'
import PhotoTile from './PhotoTile.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('PhotoGrid', () => {
  it('is a named list with one item per tile, in the order given', () => {
    view.render(
      <PhotoGrid label="Photos on this phone">
        <PhotoTile key="a" date="Sun 18 Oct" label="Sun 18 Oct" onClick={() => {}} />
        <PhotoTile key="b" date="Sun 4 Oct" label="Sun 4 Oct" onClick={() => {}} />
      </PhotoGrid>,
    )
    const list = view.host.querySelector('ul.g-phgrid')
    expect(list.getAttribute('aria-label')).toBe('Photos on this phone')
    expect([...list.querySelectorAll('li .g-ptile-date')].map(d => d.textContent)).toEqual(['Sun 18 Oct', 'Sun 4 Oct'])
  })
})
