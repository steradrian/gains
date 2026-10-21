// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import Tag from './Tag.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('Tag', () => {
  it('is accent by default, takes an icon, and has a glass tone for the stage', () => {
    view.render(<Tag icon="check">New</Tag>)
    expect(view.host.firstElementChild.className).toBe('g-tag g-tag-accent')
    expect(view.host.querySelector('svg')).not.toBeNull()
    view.render(<Tag tone="glass">New best</Tag>)
    expect(view.host.firstElementChild.className).toBe('g-tag g-tag-glass')
  })

  it('refuses a tone the design system does not have, in development', () => {
    expect(() => view.render(<Tag tone="loud">x</Tag>)).toThrow(/tone="loud"/)
  })
})
