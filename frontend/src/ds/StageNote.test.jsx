// @vitest-environment happy-dom
// StageNote: a paragraph of fine print, said and not tappable.
import { describe, expect, it } from 'vitest'
import StageNote from './StageNote.jsx'
import { useView } from './render.test-util.js'

const view = useView()

describe('StageNote', () => {
  it('says its text in a paragraph', () => {
    view.render(<StageNote>Kept for 30 days.</StageNote>)
    const p = view.host.querySelector('p.g-snote')
    expect(p.textContent).toBe('Kept for 30 days.')
    expect(view.host.querySelector('a, button')).toBeNull()
  })
})
