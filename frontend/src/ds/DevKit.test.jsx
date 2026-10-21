// @vitest-environment happy-dom
// The catalogue at #/dev/kit renders, with an entry for each of the Today hero kit's components.
import { describe, expect, it } from 'vitest'
import DevKit from './DevKit.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('DevKit', () => {
  it('renders the hero kit entries', () => {
    view.render(<DevKit />)
    const titles = [...view.host.querySelectorAll('.g-kit-sec > h2')].map(h => h.textContent)
    for (const name of ['StageHeader', 'StageRing', 'RingCarousel', 'GlassActions']) expect(titles).toContain(name)
    expect(view.host.querySelectorAll('.g-shdr')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-gacts')).toHaveLength(4)
  })
})
