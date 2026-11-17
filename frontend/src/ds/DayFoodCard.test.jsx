// @vitest-environment happy-dom
// DayFoodCard: the day's total against its target with a ring, the macro bars, a row a meal.
import { describe, expect, it, vi } from 'vitest'
import DayFoodCard from './DayFoodCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const card = () => view.host.querySelector('.g-dfood')

const MACROS = [
  { key: 'p', name: 'Protein', line: '132 of 150 g', progress: 0.88 },
  { key: 'c', name: 'Carbs', line: '214 g', progress: null },
]

describe('DayFoodCard', () => {
  it('says the total, the target and the status; the ring is decoration', () => {
    view.render(<DayFoodCard big="2,075" of="of 2,100 kcal" status="On target" progress={0.99} />)
    expect(card().querySelector('.g-dfood-num').textContent).toBe('2,075 of 2,100 kcalOn target')
    expect(card().querySelector('.g-dfood-ring').getAttribute('aria-hidden')).toBe('true')
    expect(card().querySelector('.g-dfood-fill')).not.toBeNull()
  })

  it('draws no fill with nothing eaten, and keeps a ring over the target full', () => {
    view.render(<DayFoodCard big="0" of="of 2,100 kcal" progress={0} />)
    expect(card().querySelector('.g-dfood-fill')).toBeNull()
    view.render(<DayFoodCard big="2,600" of="of 2,100 kcal" progress={1.24} />)
    expect(Number(card().querySelector('.g-dfood-fill').getAttribute('stroke-dashoffset'))).toBe(0)
  })

  it('draws a bar only for a macro with a goal', () => {
    view.render(<DayFoodCard big="1" of="of 2 kcal" macros={MACROS} />)
    const macros = [...card().querySelectorAll('.g-dfood-macro')]
    expect(macros.map(m => m.textContent)).toEqual(['Protein132 of 150 g', 'Carbs214 g'])
    expect(macros[0].querySelector('.g-dfood-bar')).not.toBeNull()
    expect(macros[1].querySelector('.g-dfood-bar')).toBeNull()
  })

  it('lists the meals; one with a tap is a button, one without is only said', () => {
    const onClick = vi.fn()
    view.render(<DayFoodCard big="1" of="of 2 kcal" meals={[
      { key: 0, icon: 'sunrise', name: 'Breakfast', sub: 'Oats with milk, Banana', value: '485', unit: 'kcal', onClick },
      { key: 3, icon: 'apple', name: 'Snacks', sub: 'Nothing logged' },
    ]} />)
    const rows = [...card().querySelectorAll('.g-dfood-meal')]
    expect(rows[0].tagName).toBe('BUTTON')
    expect(rows[0].textContent).toBe('BreakfastOats with milk, Banana485 kcal')
    expect(rows[1].tagName).toBe('DIV')
    expect(rows[1].querySelector('.g-dfood-kcal')).toBeNull()
    click(rows[0])
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
