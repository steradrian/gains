// @vitest-environment happy-dom
// Illustration: a scene draws itself in the first time it shows in a session and is simply there
// after that; `draw` replays it every time; under reduced motion it fades in instead of drawing.
import { useLayoutEffect, useRef } from 'react'
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
  it('has the eight onboarding scenes and the Coach page\'s, each hidden from a screen reader', () => {
    expect(SCENE_NAMES).toEqual(['invite', 'passkey', 'goal', 'birthday', 'height', 'weight', 'week', 'plan', 'coach'])
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

  // The onboarding's thread registers its anchor in a layout effect of the screen around the
  // drawing: the path must be in the ref by then, drawn in or not.
  it.each([
    ['floor', 'goal', 'il-floor', 'M16 128 H304'],
    ['accent', 'height', 'il-acc', 'M116 54 H176'],
    ['shaft', 'passkey', 'kshaft', 'M124 56 H248'],
  ])('hands its %s to anchorRef before the screen\'s layout effects run', (anchor, name, cls, d) => {
    const seen = []
    function Screen() {
      const ref = useRef(null)
      useLayoutEffect(() => { seen.push(ref.current) }, [])
      return <Illustration name={name} draw="once" anchor={anchor} anchorRef={ref} />
    }
    view.render(<Screen />)
    expect(seen).toHaveLength(1)
    expect(seen[0].classList.contains(cls)).toBe(true)
    expect(seen[0].getAttribute('d')).toBe(d)
  })

  it('keeps its paths, and what was set on them, when the screen renders it again', () => {
    const ref = { current: null }
    view.render(<Illustration name="goal" draw="once" anchor="floor" anchorRef={ref} style={{ '--r': '0deg' }} />)
    const floor = ref.current
    floor.setAttribute('data-thread', 'line')
    view.render(<Illustration name="goal" draw="once" anchor="floor" anchorRef={ref} style={{ '--r': '6deg' }} />)
    expect(floor.isConnected).toBe(true)
    expect(ref.current).toBe(floor)
    expect(art().querySelector('[data-thread]')).toBe(floor)
  })

  it('takes the screen\'s moving parts: a class and custom properties, SVG parts over it, HTML on it', () => {
    view.render(
      <Illustration name="goal" className="tilted" style={{ '--r': '6deg' }} width={260} overlay={<span className="ov">1990</span>}>
        <path className="extra" d="M0 0 H10" />
      </Illustration>,
    )
    expect(art().classList.contains('tilted')).toBe(true)
    expect(art().style.getPropertyValue('--r')).toBe('6deg')
    expect(art().style.getPropertyValue('--g-ill-w')).toBe('260px')
    expect(art().querySelector('svg > path.extra')).not.toBeNull()
    expect(art().querySelector(':scope > .ov').textContent).toBe('1990')
  })

  it('runs the scale\'s tape over the whole range, the marks at rest where the bundle draws them', () => {
    view.render(<Illustration name="weight" />)
    const tape = art().querySelector('.stape path').getAttribute('d')
    expect(tape.startsWith('M20 44v14M24 44v8')).toBe(true)
    expect(tape).toContain('M120 44v14M124 44v8M128 44v8M132 44v8M136 44v8M140 44v14')
    expect(tape.endsWith('M880 44v14')).toBe(true)
  })
})
