// @vitest-environment happy-dom
// Illustration: a scene draws itself in the first time it shows in a session and is simply there
// after that; `draw` replays it every time; under reduced motion it fades in instead of drawing.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDrawIn } from '../lib/use-draw-in.js'
import Illustration from './Illustration.jsx'
import { SCENE_NAMES } from './illustration-scenes.js'
import { useView } from './render.test-util.js'

const view = useView()
beforeEach(() => resetDrawIn())
afterEach(() => { delete document.documentElement.dataset.motion })

const art = () => view.host.querySelector('.g-ill')
const drawing = () => art().classList.contains('g-ill-draw') && art().querySelectorAll('[pathLength="1"].dr').length > 0
const fading = () => art().classList.contains('g-ill-fade')
const still = () => !drawing() && !fading() && art().querySelectorAll('.dr, .fd').length === 0

describe('Illustration', () => {
  it('has the eight onboarding scenes, each hidden from a screen reader', () => {
    expect(SCENE_NAMES).toEqual(['invite', 'passkey', 'goal', 'birthday', 'height', 'weight', 'week', 'plan'])
    for (const name of SCENE_NAMES) {
      view.render(<Illustration name={name} />)
      expect(art().querySelector('svg').getAttribute('aria-hidden')).toBe('true')
      expect(art().querySelector('svg').innerHTML).not.toContain('__ID__')
    }
  })

  it('draws once a session with draw="once", then is static', () => {
    view.render(<Illustration name="passkey" draw="once" />)
    expect(drawing()).toBe(true)
    view.render(null)
    view.render(<Illustration name="passkey" draw="once" />)
    expect(still()).toBe(true)
  })

  it('counts each scene on its own', () => {
    view.render(<Illustration name="goal" draw="once" />)
    view.render(null)
    view.render(<Illustration name="week" draw="once" />)
    expect(drawing()).toBe(true)
  })

  it('keeps drawing while it stays on screen, though the scene now counts as shown', () => {
    view.render(<Illustration name="plan" draw="once" />)
    view.render(<Illustration name="plan" draw="once" tone="stage" />)
    expect(drawing()).toBe(true)
  })

  it('draws every time with draw, and not at all without it', () => {
    view.render(<Illustration name="height" draw />)
    expect(drawing()).toBe(true)
    view.render(null)
    view.render(<Illustration name="height" draw />)
    expect(drawing()).toBe(true)
    view.render(<Illustration name="weight" />)
    expect(still()).toBe(true)
  })

  it('fades in instead of drawing under the app\'s reduce motion', () => {
    document.documentElement.dataset.motion = 'reduce'
    view.render(<Illustration name="invite" draw="once" />)
    expect(fading()).toBe(true)
    expect(art().querySelectorAll('.dr').length).toBe(0)
    view.render(null)
    view.render(<Illustration name="invite" draw="once" />)
    expect(still()).toBe(true)
    view.render(<Illustration name="birthday" draw />)
    expect(fading()).toBe(true)
  })

  it('gives each drawing its own clip path ids', () => {
    view.render(<><Illustration name="weight" /><Illustration name="weight" /></>)
    const ids = [...view.host.querySelectorAll('clipPath')].map(c => c.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
