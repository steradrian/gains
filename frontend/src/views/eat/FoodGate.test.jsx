// @vitest-environment happy-dom
// Eat with Food switched off (Settings > Features): the tab root and every page under it show
// "Food is off" instead, and the button turns Food back on in place. Nothing is deleted.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { click, useView } from '../../ds/render.test-util.js'
import { useStore } from '../../store/useStore.js'
import FoodGate from './FoodGate.jsx'

vi.mock('../../ds/Illustration.jsx', () => ({ default: ({ name }) => <i data-scene={name} /> }))

const view = useView()

const mount = path => view.render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route element={<FoodGate />}>
        <Route path="/food" element={<p>Eat root</p>} />
        <Route path="/food/month" element={<p>Month page</p>} />
      </Route>
    </Routes>
  </MemoryRouter>,
)
const setFood = on => useStore.setState(st => ({ S: { ...st.S, trackFood: on } }))
const turnOn = () => [...view.host.querySelectorAll('button')].find(b => b.textContent === 'Turn Food back on')

describe('Eat with Food off', () => {
  beforeEach(() => setFood(false))

  it('shows the plate scene, the title, the line and the button on the tab root', () => {
    mount('/food')
    expect(view.host.textContent).not.toContain('Eat root')
    expect(view.host.querySelector('.g-sempty b').textContent).toBe('Food is off')
    expect(view.host.querySelector('.g-sempty').textContent).toContain('Turn it on to log meals, water and fasting.')
    expect(view.host.querySelector('[data-scene]').getAttribute('data-scene')).toBe('plate')
    expect(turnOn()).toBeTruthy()
  })

  it('falls back to the same state on a page reached by deep link', () => {
    mount('/food/month')
    expect(view.host.textContent).not.toContain('Month page')
    expect(view.host.querySelector('.g-sempty b').textContent).toBe('Food is off')
  })

  it('Turn Food back on sets trackFood and brings the page back in place', () => {
    mount('/food/month')
    click(turnOn())
    expect(useStore.getState().S.trackFood).toBe(true)
    expect(view.host.textContent).toContain('Month page')
    expect(view.host.querySelector('.g-sempty')).toBeNull()
  })
})

describe('Eat with Food on', () => {
  it('renders the page, and a profile from before the switch existed reads as on', () => {
    useStore.setState(st => {
      const { trackFood: _dropped, ...rest } = st.S
      return { S: rest }
    })
    mount('/food')
    expect(view.host.textContent).toContain('Eat root')
  })
})
