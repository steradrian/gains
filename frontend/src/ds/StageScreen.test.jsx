// @vitest-environment happy-dom
// StageScreen: the design system's root, so its tokens reach what is inside and nothing else, with
// its own accent preset, never the app's <html data-accent>.
import { describe, expect, it } from 'vitest'
import StageScreen from './StageScreen.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const screen = () => view.host.firstElementChild

describe('StageScreen', () => {
  it('is a .g-root on the stage, holding what it is given', () => {
    view.render(<StageScreen><p id="inside">Welcome back</p></StageScreen>)
    expect(screen().classList.contains('g-root')).toBe(true)
    expect(screen().querySelector('.g-stage .g-stage-body #inside')).not.toBeNull()
  })

  it('is cobalt unless told otherwise', () => {
    view.render(<StageScreen />)
    expect(screen().dataset.accent).toBe('cobalt')
    view.render(<StageScreen accent="moss" />)
    expect(screen().dataset.accent).toBe('moss')
  })

  it('leaves the app\'s own accent alone', () => {
    document.documentElement.dataset.accent = 'sky'
    try {
      view.render(<StageScreen accent="ember" />)
      expect(document.documentElement.dataset.accent).toBe('sky')
    } finally { delete document.documentElement.dataset.accent }
  })

  it('refuses an accent the design system has no preset for, in development', () => {
    expect(() => view.render(<StageScreen accent="sky" />)).toThrow(/accent="sky"/)
  })
})
