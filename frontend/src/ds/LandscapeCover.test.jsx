// @vitest-environment happy-dom
// LandscapeCover: the portrait-only app's cover for a phone held sideways.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import LandscapeCover from './LandscapeCover.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const css = readFileSync(join(import.meta.dirname, 'ds.css'), 'utf8')

describe('LandscapeCover', () => {
  it('says to turn the phone upright on the stage, with line art and no button', () => {
    view.render(<LandscapeCover />)
    const root = view.host.querySelector('.g-landscape-cover')
    expect(root.classList.contains('g-root')).toBe(true)
    expect(root.querySelector('.g-sempty b').textContent).toBe('Turn your phone upright')
    expect(root.querySelector('.g-sempty .g-ill')).not.toBeNull()
    expect(root.querySelector('.g-sempty').className).not.toContain('g-glass')
    expect(root.querySelectorAll('button, a')).toHaveLength(0)
  })

  it('is hidden except on a short landscape touch screen', () => {
    expect(css).toMatch(/\.g-landscape-cover \{ display: none; \}/)
    const media = css.match(/@media \(orientation: landscape\) and \(max-height: 500px\) and \(pointer: coarse\) \{[^}]*\.g-landscape-cover \{[^}]*display: block; position: fixed; inset: 0;/)
    expect(media).not.toBeNull()
  })
})
