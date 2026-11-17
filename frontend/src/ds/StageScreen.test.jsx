// @vitest-environment happy-dom
// StageScreen: the design system's root, so its tokens reach what is inside and nothing else, with
// its own accent preset, never the app's <html data-accent>.
import { readFileSync } from 'node:fs'
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

  // Light mode's --focus is near-black, about 1.3:1 on the dark stage: the stage sets its own, so
  // every control on it (tiles, glass rows, the water +, week cells) shows its keyboard focus.
  it('gives everything on the stage a focus ring in the stage\'s ink', () => {
    const ds = readFileSync(process.cwd() + '/src/ds/ds.css', 'utf8')
    expect(ds.match(/\n\.g-stage \{([^}]*)\}/)[1]).toMatch(/--focus: var\(--on-stage\);/)
  })

  // A pushed page draws the stage at half the roots' intensity; the roots (the default) are as ever.
  it('marks a pushed page, and only that, with the half-intensity class the stylesheet dims', () => {
    view.render(<StageScreen />)
    expect(screen().classList.contains('g-screen-pushed')).toBe(false)
    view.render(<StageScreen pushed />)
    expect(screen().classList.contains('g-screen-pushed')).toBe(true)
    expect(screen().classList.contains('g-screen')).toBe(true)
    const ds = readFileSync(process.cwd() + '/src/ds/ds.css', 'utf8')
    expect(ds).toMatch(/\.g-screen-pushed \.g-stage-glow-a \{ opacity: \.25; \}/)
    expect(ds).toMatch(/\.g-screen-pushed \.g-stage-rings \{ opacity: \.5; \}/)
  })

  it('refuses an accent the design system has no preset for, in development', () => {
    expect(() => view.render(<StageScreen accent="sky" />)).toThrow(/accent="sky"/)
  })
})
