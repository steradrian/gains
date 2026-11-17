// @vitest-environment happy-dom
// StageWeekMarks: seven named days, each its mark; a day goes somewhere only with a handler or link.
import { describe, expect, it, vi } from 'vitest'
import StageWeekMarks from './StageWeekMarks.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const STATES = ['done', 'rest', 'missed', 'today', 'planned', 'rest', 'planned']
const days = (extra = {}) => STATES.map((state, i) => ({ key: String(i), dow: 'MTWTFSS'[i], state, label: `Day ${i + 1}, ${state}`, ...extra }))

describe('StageWeekMarks', () => {
  it('is a group named This week, a day each with its mark and its words', () => {
    view.render(<StageWeekMarks days={days()} />)
    const strip = view.host.querySelector('.g-wk')
    expect(strip.getAttribute('role')).toBe('group')
    expect(strip.getAttribute('aria-label')).toBe('This week')
    const cells = [...strip.querySelectorAll('.g-wk-cell')]
    expect(cells.map(c => c.tagName)).toEqual(Array(7).fill('SPAN'))
    expect(cells.map(c => c.getAttribute('aria-label'))).toEqual(STATES.map((s, i) => `Day ${i + 1}, ${s}`))
    expect(cells.map(c => c.querySelector('.g-wk-m').className.replace('g-wk-m g-wk-', ''))).toEqual(STATES)
    expect(cells[0].querySelector('[data-icon="check"]')).toBeTruthy()
    expect(cells[2].querySelector('[data-icon="xmark"]')).toBeTruthy()
    expect(cells[1].querySelector('.g-wk-rest i')).toBeTruthy()
  })

  it('a day with a handler is a button, with a link a link', () => {
    const onClick = vi.fn()
    view.render(<StageWeekMarks days={days({ onClick })} label="Week of 12 Oct" />)
    expect(view.host.querySelector('.g-wk').getAttribute('aria-label')).toBe('Week of 12 Oct')
    const first = view.host.querySelector('button.g-wk-cell')
    expect(first.getAttribute('aria-label')).toBe('Day 1, done')
    click(first)
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<StageWeekMarks days={days({ href: '#/day' })} />)
    expect(view.host.querySelectorAll('a.g-wk-cell')).toHaveLength(7)
  })
})
