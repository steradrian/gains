// @vitest-environment happy-dom
// A search's Day result lands on `?date=&find=<uuid>`: wherever the diary renders, the entry's
// meal opens and the entry flashes; on another date, or with nothing to find, nothing moves.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MealsCard from './MealsCard.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })

const day = {
  settings: { mealNames: ['Breakfast', 'Lunch', 'Dinner', 'Snacks'] },
  entry: { items: [
    { uuid: 'a', meal: 0, name: 'Oats', quantity: 1, nutrition: { calories: 300 }, addedAt: '2026-10-11T07:00:00Z' },
    { uuid: 'b', meal: 1, name: 'Chicken bowl', quantity: 1, nutrition: { calories: 640 }, addedAt: '2026-10-11T12:00:00Z' },
  ] },
  activityRows: [], target: {}, activitySum: null,
}
const render = url => act(() => root.render(<MemoryRouter initialEntries={[url]}><MealsCard date="2026-10-11" day={day} /></MemoryRouter>))
const toggles = () => [...host.querySelectorAll('.meal-toggle')]

describe('MealsCard and ?find=', () => {
  it('opens the meal that holds the entry and flashes it', () => {
    render('/food?date=2026-10-11&find=b')
    expect(toggles().map(b => b.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false', 'false'])
    expect(host.querySelector('li.flash-find').textContent).toContain('Chicken bowl')
  })

  it('does nothing on another date, or without a find', () => {
    render('/food?date=2026-10-12&find=b')
    expect(toggles().every(b => b.getAttribute('aria-expanded') === 'false')).toBe(true)
    render('/home')
    expect(host.querySelector('.flash-find')).toBeNull()
  })
})
