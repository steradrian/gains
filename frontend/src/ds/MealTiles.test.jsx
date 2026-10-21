// @vitest-environment happy-dom
// MealTiles: a logged tile carries a check, an empty one says so, the meal due is the one solid
// tile with a +. A tap says which meal.
import { describe, expect, it, vi } from 'vitest'
import MealTiles from './MealTiles.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tiles = () => [...view.host.querySelectorAll('.g-tile')]

const MEALS = [
  { icon: 'sunrise', name: 'Breakfast', sub: '420 kcal', state: 'done' },
  { icon: 'sun', name: 'Lunch', sub: 'Add now', state: 'now' },
  { icon: 'moon', name: 'Dinner', sub: 'Nothing yet', state: 'empty' },
  { icon: 'apple', name: 'Snacks', sub: '1,240 kcal', state: 'done', href: '#/eat' },
]

describe('MealTiles', () => {
  it('draws a logged meal with a check, an empty one without, and only the due one solid with a +', () => {
    view.render(<MealTiles meals={MEALS} />)
    expect(tiles().map(t => t.textContent)).toEqual(['Breakfast420 kcal', 'LunchAdd now', 'DinnerNothing yet', 'Snacks1,240 kcal'])
    expect(tiles().map(t => !!t.querySelector('.g-tile-done'))).toEqual([true, false, false, true])
    expect(tiles()[0].querySelector('[aria-label="Logged"]')).not.toBeNull()
    expect(tiles().map(t => t.classList.contains('g-tile-now'))).toEqual([false, true, false, false])
    expect(tiles().map(t => t.classList.contains('g-glass'))).toEqual([true, false, true, true])
    expect(tiles().map(t => !!t.querySelector('.g-tile-body .g-icon'))).toEqual([false, true, false, false])
  })

  it('tells onPick the meal and its place', () => {
    const onPick = vi.fn()
    view.render(<MealTiles meals={MEALS} onPick={onPick} />)
    click(tiles()[2])
    expect(onPick).toHaveBeenCalledWith(MEALS[2], 2)
  })

  it('is a link when a meal has an href', () => {
    view.render(<MealTiles meals={MEALS} />)
    expect(tiles().map(t => t.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'A'])
    expect(tiles()[3].getAttribute('href')).toBe('#/eat')
  })

  it('keeps a long name and a long number whole in the DOM; the CSS wraps the name and grows the tile', () => {
    view.render(<MealTiles meals={[{ name: 'Gustare de după-amiază', sub: '1,234,567 kcal logged', state: 'done' }]} />)
    expect(tiles()[0].textContent).toBe('Gustare de după-amiază1,234,567 kcal logged')
  })

  it('refuses a state the design system does not have, in development', () => {
    expect(() => view.render(<MealTiles meals={[{ name: 'Lunch', state: 'later' }]} />)).toThrow(/state="later"/)
  })
})
