// @vitest-environment happy-dom
// BodyMap (design system): the app's geometry in the stage's or a light surface's shades.
import { beforeAll, describe, expect, it, vi } from 'vitest'
import BodyMap from './BodyMap.jsx'
import { useView } from './render.test-util.js'
import { act } from 'react'

// The geometry is a dynamic import on first render; load it here so the wait covers rendering, not
// a cold module load on a slow runner (components/BodyMap.test.jsx does the same).
beforeAll(() => import('../lib/body-paths.js'))

const view = useView()

async function shown(props) {
  await act(async () => { view.render(<BodyMap {...props} />) })
  await vi.waitFor(() => expect(view.host.querySelector('svg')).not.toBeNull())
}

describe('BodyMap', () => {
  it('draws front and back, shading each muscle by its level', async () => {
    await shown({ levels: { chest: 4, biceps: 2 } })
    expect(view.host.querySelectorAll('svg')).toHaveLength(2)
    expect(view.host.querySelector('.g-bmap-stage')).not.toBeNull()
    expect(view.host.querySelector('.g-bm-m.l4')).not.toBeNull()
    expect(view.host.querySelector('.g-bm-m.l2')).not.toBeNull()
    expect(view.host.querySelector('.g-bm-m.l0')).not.toBeNull()
  })

  it('is hidden from a screen reader unless it has a label, then names each view', async () => {
    await shown({})
    expect([...view.host.querySelectorAll('svg')].every(s => s.getAttribute('aria-hidden') === 'true')).toBe(true)
    await shown({ label: 'Push A muscles' })
    expect([...view.host.querySelectorAll('svg')].map(s => s.getAttribute('aria-label'))).toEqual(['Push A muscles, Front', 'Push A muscles, Back of the body'])
  })

  it('can draw one view, light, with a muscle picked out', async () => {
    await shown({ views: ['front'], tone: 'light', selected: 'chest', levels: { chest: 3 } })
    expect(view.host.querySelectorAll('svg')).toHaveLength(1)
    expect(view.host.querySelector('.g-bmap-light')).not.toBeNull()
    expect(view.host.querySelector('.g-bm-m.sel')).not.toBeNull()
  })

  it('holds the space with an empty box until the geometry is there', () => {
    view.render(<BodyMap />)
    expect(view.host.firstElementChild.className).toContain('g-bmap')
  })

  it('with onMuscle every muscle is a button, named, pressed when selected, and the map is a group', async () => {
    const onMuscle = vi.fn()
    await shown({ onMuscle, selected: 'chest', label: 'Muscle map' })
    expect(view.host.querySelector('svg').getAttribute('role')).toBe('group')
    expect(view.host.querySelector('svg').getAttribute('aria-hidden')).toBeNull()
    const chest = [...view.host.querySelectorAll('[role="button"]')].filter(p => p.getAttribute('aria-label') === 'Chest')
    expect(chest.length).toBeGreaterThan(0)
    expect(chest[0].getAttribute('aria-pressed')).toBe('true')
    expect(chest[0].tabIndex).toBe(0)
    act(() => { chest[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(onMuscle).toHaveBeenCalledWith('chest')
    const biceps = view.host.querySelector('[aria-label="Biceps"]')
    expect(biceps.getAttribute('aria-pressed')).toBe('false')
    act(() => { biceps.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(onMuscle).toHaveBeenLastCalledWith('biceps')
  })

  it('without onMuscle the muscles are plain shapes', async () => {
    await shown({})
    expect(view.host.querySelector('[role="button"]')).toBeNull()
  })

  it('refuses a tone the design system does not have, in development', () => {
    expect(() => view.render(<BodyMap tone="dark" />)).toThrow(/tone="dark"/)
  })
})
