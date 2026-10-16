// @vitest-environment happy-dom
// LineArt: each scene holds the onboarding's rules (no figure, ≤8 paths, ≤3 accent paths,
// decorative to a screen reader), reacts to its state, and draws in once a session.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDrawIn } from '../lib/use-draw-in.js'
import { EQUIPMENT, ILLUSTRATIONS, LineArt, LINE_ART_SCENES, equipmentOf } from './line-art.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => {
  resetDrawIn()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  delete document.documentElement.dataset.motion
})

const render = el => act(() => root.render(el))
const svg = () => host.querySelector('svg')
const shapes = () => [...svg().querySelectorAll('path, rect, circle')].filter(e => !e.closest('clipPath'))

const CASES = [
  ['routine', {}], ['routine', { days: 3, next: 1 }], ['routine', { days: 2, scheduled: false }],
  ['mobility', { minutes: 20 }], ['mobility', {}], ['scale', { kg: 82.4 }], ['scale', {}],
  ...EQUIPMENT.map(eq => ['equipment', { eq }]), ['plate', {}], ['chart', {}],
  // every empty-state illustration, in the state it is drawn in
  ...Object.values(ILLUSTRATIONS).map(({ scene, state }) => [scene, state]),
]

describe('LineArt', () => {
  it('knows its scenes: six of its own and the empty states\' thirteen', () => {
    expect(LINE_ART_SCENES).toEqual([
      'routine', 'mobility', 'scale', 'equipment', 'plate', 'chart',
      'calendar', 'week', 'envelope', 'key', 'coach', 'search', 'rotation', 'favourites', 'photo', 'tape', 'pantry', 'fasting', 'recovery',
    ])
    expect(() => render(<LineArt scene="figure" />)).toThrow(/LineArt: scene="figure"/)
  })

  for (const [scene, state] of CASES) {
    it(`${scene} ${JSON.stringify(state)}: decorative, at most 8 paths and 3 accent ones, on the floor`, () => {
      render(<LineArt scene={scene} state={state} />)
      expect(svg().getAttribute('aria-hidden')).toBe('true')
      expect(svg().getAttribute('viewBox')).toBe('0 0 96 72')
      expect(svg().querySelector('text')).toBeNull()
      expect(shapes().length).toBeLessThanOrEqual(8)
      expect(svg().querySelectorAll('.il-acc').length).toBeLessThanOrEqual(3)
      expect(svg().querySelector('.il-floor').getAttribute('d')).toBe('M8 64H88')
    })
  }

  it('routine: a row per day up to three, the next one in the accent on the lit band', () => {
    render(<LineArt scene="routine" state={{ days: 5, next: 2 }} />)
    expect(svg().querySelectorAll('path.il-d, path.il-acc')).toHaveLength(3)
    expect(svg().querySelectorAll('path.il-acc')).toHaveLength(1)
    expect(svg().querySelector('rect.il-lit').getAttribute('y')).toBe('38')
    render(<LineArt scene="routine" state={{ days: 0 }} />)
    expect(svg().querySelector('.il-dash')).not.toBeNull()
    expect(svg().querySelector('path.il-acc').getAttribute('d')).toBe('M48 26v16M40 34h16')
    render(<LineArt scene="routine" state={{ days: 2, scheduled: false }} />)
    expect(svg().querySelectorAll('path.il-mute')).toHaveLength(2)
  })

  it('chart: both axes stand on the floor line, like every other scene', () => {
    render(<LineArt scene="chart" state={{}} />)
    const floorY = /^M\d+ (\d+)H/.exec(svg().querySelector('.il-floor').getAttribute('d'))[1]
    const axes = svg().querySelector('path.il:not(.il-mute)').getAttribute('d')
    expect(axes).toBe(`M22 10V${floorY}H84`)
    expect(shapes().at(-1).classList.contains('il-acc')).toBe(true)
  })

  it('mobility: the accent arc is the minutes out of an hour', () => {
    render(<LineArt scene="mobility" state={{ minutes: 20 }} />)
    expect(svg().querySelector('.il-acc').getAttribute('stroke-dasharray')).toBe('20 60')
    render(<LineArt scene="mobility" state={{ minutes: 90 }} />)
    expect(svg().querySelector('.il-acc').getAttribute('stroke-dasharray')).toBe('60 60')
    render(<LineArt scene="mobility" state={{ minutes: 0 }} />)
    expect(svg().querySelector('.il-acc')).toBeNull()
  })

  it('scale: the tape moves to the weight under a fixed needle; none without a weigh-in', () => {
    const tape = () => svg().querySelector('g path')
    render(<LineArt scene="scale" state={{ kg: 80 }} />)
    expect(tape().getAttribute('transform')).toBe('translate(-52 0)')
    expect(svg().querySelector('.il-acc').getAttribute('d')).toBe('M48 17v12')
    render(<LineArt scene="scale" state={{ kg: 60 }} />)
    expect(tape().getAttribute('transform')).toBe('translate(-12 0)')
    render(<LineArt scene="scale" state={{}} />)
    expect(tape().classList.contains('il-mute')).toBe(true)
    expect(svg().querySelector('.il-acc')).toBeNull()
  })

  it('equipment: maps the catalogue\'s equipment to five drawings, never a figure', () => {
    expect(['barbell', 'smith machine', 'landmine'].map(equipmentOf)).toEqual(['barbell', 'barbell', 'barbell'])
    expect(['dumbbell', 'kettlebell'].map(equipmentOf)).toEqual(['dumbbell', 'dumbbell'])
    expect(['cable', 'band'].map(equipmentOf)).toEqual(['cable', 'cable'])
    expect(['leverage machine'].map(equipmentOf)).toEqual(['machine'])
    expect(['body weight', 'custom', undefined].map(equipmentOf)).toEqual(['bodyweight', 'bodyweight', 'bodyweight'])
    expect(() => render(<LineArt scene="equipment" state={{ eq: 'rower' }} />)).toThrow(/LineArt: eq="rower"/)
  })

  it('draws in the first time a scene shows in a session, and is simply there after', () => {
    render(<LineArt scene="routine" state={{ days: 1 }} />)
    expect(svg().classList.contains('il-draw')).toBe(true)
    act(() => root.unmount())
    root = createRoot(host)
    render(<LineArt scene="routine" state={{ days: 1 }} />)
    expect(svg().classList.contains('il-draw')).toBe(false)
    // another scene has its own first time
    render(<LineArt scene="scale" state={{}} />)
    expect(svg().classList.contains('il-draw')).toBe(true)
  })

  it('ILLUSTRATIONS: each name draws a scene in its empty state', () => {
    expect(Object.keys(ILLUSTRATIONS)).toEqual([
      'scale', 'routine', 'plate', 'barbell', 'dumbbell', 'chart',
      'calendar', 'week', 'envelope', 'key', 'coach', 'search', 'rotation', 'favourites', 'photo', 'tape', 'pantry', 'fasting', 'recovery',
    ])
    for (const { scene } of Object.values(ILLUSTRATIONS)) expect(LINE_ART_SCENES).toContain(scene)
    render(<LineArt scene={ILLUSTRATIONS.scale.scene} state={ILLUSTRATIONS.scale.state} />)
    expect(svg().querySelector('.il-acc')).toBeNull()
    render(<LineArt scene={ILLUSTRATIONS.routine.scene} state={ILLUSTRATIONS.routine.state} />)
    expect(svg().querySelector('.il-dash')).not.toBeNull()
  })

  for (const [name, { scene, state }] of Object.entries(ILLUSTRATIONS)) {
    it(`illustration ${name}: inks from classes only, drawn in back to front with the accent last`, () => {
      render(<LineArt scene={scene} state={state} />)
      expect(svg().querySelector('[fill], [stroke]')).toBeNull()
      const order = [...svg().querySelectorAll('[pathLength]')].map(e => Number(e.style.getPropertyValue('--i')))
      expect(order).toEqual([...order].sort((a, b) => a - b))
      expect(new Set(order).size).toBe(order.length)
      if (svg().querySelector('.il-acc')) expect(shapes().at(-1).classList.contains('il-acc')).toBe(true)
    })
  }

  it('drawKey counts the first showing under its own name, not the scene\'s', () => {
    render(<LineArt scene="equipment" state={{ eq: 'barbell' }} drawKey="empty:barbell" />)
    expect(svg().classList.contains('il-draw')).toBe(true)
    render(<LineArt scene="equipment" state={{ eq: 'dumbbell' }} drawKey="empty:dumbbell" />)
    expect(svg().classList.contains('il-draw')).toBe(true)
    act(() => root.unmount())
    root = createRoot(host)
    render(<LineArt scene="equipment" state={{ eq: 'barbell' }} drawKey="empty:barbell" />)
    expect(svg().classList.contains('il-draw')).toBe(false)
    // the scene's own key is a different one
    render(<LineArt scene="equipment" state={{ eq: 'barbell' }} />)
    expect(svg().classList.contains('il-draw')).toBe(true)
  })

  it('fades in instead under reduced motion', () => {
    document.documentElement.dataset.motion = 'reduce'
    render(<LineArt scene="mobility" state={{ minutes: 10 }} />)
    expect(svg().classList.contains('rm-fade')).toBe(true)
    expect(svg().classList.contains('il-draw')).toBe(false)
  })
})
