// @vitest-environment happy-dom
// StageWeekCells: seven days, each its mark and its kcal ring (or "–"); today's date lit; a cell
// goes somewhere only with a handler or link; food off drops the kcal row and its key.
import { describe, expect, it, vi } from 'vitest'
import StageWeekCells from './StageWeekCells.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const TRAINING = ['done', 'rest', 'done', 'rest', 'missed', 'skipped', 'planned']
const KCAL = [0.94, 1.1, 0.99, null, 0.76, 0.5, null]
const days = (extra = {}) => TRAINING.map((training, i) => ({
  key: String(i), dow: 'MTWTFSS'[i], date: 12 + i, training, kcal: KCAL[i], over: i === 1, today: i === 6, label: `Day ${12 + i}, ${training}`, ...extra,
}))
const cells = () => [...view.host.querySelectorAll('.g-swc-cell')]

describe('StageWeekCells', () => {
  it('draws each day\'s mark, date and kcal ring, today lit, the legend under them', () => {
    view.render(<StageWeekCells days={days()} label="12 to 18 Oct" />)
    expect(view.host.querySelector('.g-swc').getAttribute('aria-label')).toBe('12 to 18 Oct')
    expect(cells().map(c => c.querySelector('.g-swc-m').className.replace('g-swc-m g-swc-', ''))).toEqual(TRAINING)
    expect(cells()[0].querySelector('[data-icon="check"]')).toBeTruthy()
    expect(cells()[4].querySelector('[data-icon="xmark"]')).toBeTruthy()
    expect(cells()[5].querySelector('[data-icon="skipForward"]')).toBeTruthy()
    expect(cells()[1].querySelector('.g-swc-rest i')).toBeTruthy()
    expect(cells().map(c => c.querySelector('.g-swc-date').classList.contains('on'))).toEqual([false, false, false, false, false, false, true])
    expect(cells().map(c => (c.querySelector('.g-mring') ? 'ring' : c.querySelector('.g-swc-none').textContent))).toEqual(['ring', 'ring', 'ring', '–', 'ring', 'ring', '–'])
    expect(cells()[1].querySelector('.g-mring-over')).toBeTruthy()
    expect(cells()[0].querySelector('.g-mring-over')).toBeNull()
    expect(view.host.querySelector('.g-swc-legend').textContent).toBe('WorkoutMissedkcal against target')
  })

  it('names each cell by its label; a still cell is an image, not a control', () => {
    view.render(<StageWeekCells days={days()} />)
    expect(cells().map(c => c.tagName)).toEqual(Array(7).fill('SPAN'))
    expect(cells()[0].getAttribute('role')).toBe('img')
    expect(cells()[0].getAttribute('aria-label')).toBe('Day 12, done')
  })

  it('a cell with a handler is a button that calls it, with a link a link', () => {
    const onClick = vi.fn()
    view.render(<StageWeekCells days={days({ onClick })} />)
    const buttons = view.host.querySelectorAll('button.g-swc-cell')
    expect(buttons).toHaveLength(7)
    click(buttons[2])
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<StageWeekCells days={days({ href: '#/day' })} />)
    expect(view.host.querySelectorAll('a.g-swc-cell')).toHaveLength(7)
  })

  it('food off: no kcal row and no kcal key; legend off: no key at all', () => {
    view.render(<StageWeekCells days={days()} food={false} />)
    expect(view.host.querySelector('.g-swc-grid .g-mring')).toBeNull()
    expect(view.host.querySelector('.g-swc-none')).toBeNull()
    expect(view.host.querySelector('.g-swc-legend').textContent).toBe('WorkoutMissed')
    view.render(<StageWeekCells days={days()} legend={false} />)
    expect(view.host.querySelector('.g-swc-legend')).toBeNull()
  })
})
