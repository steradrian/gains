// @vitest-environment happy-dom
// WeekStrip4: four weeks, a bar per planned workout lit per one done, the week on screen edged
// and current, each named in words; a cell goes somewhere only with a handler or link.
import { describe, expect, it, vi } from 'vitest'
import WeekStrip4 from './WeekStrip4.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const WEEKS = [
  { key: 'a', label: '21 Sep', done: 4, planned: 4 },
  { key: 'b', label: '28 Sep', done: 3, planned: 4 },
  { key: 'c', label: '5 Oct', done: 3, planned: 4 },
  { key: 'd', label: '12 Oct', done: 2, planned: 4 },
]
const cells = () => [...view.host.querySelectorAll('.g-w4-cell')]

describe('WeekStrip4', () => {
  it('draws the bars, the count and the words for each week', () => {
    view.render(<WeekStrip4 weeks={WEEKS} active={3} />)
    expect(cells()).toHaveLength(4)
    expect(cells().map(c => c.querySelectorAll('.g-w4-bars i').length)).toEqual([4, 4, 4, 4])
    expect(cells().map(c => c.querySelectorAll('.g-w4-bars i.on').length)).toEqual([4, 3, 3, 2])
    expect(cells().map(c => c.querySelector('.g-w4-n').textContent)).toEqual(['4 of 4', '3 of 4', '3 of 4', '2 of 4'])
    expect(cells()[1].getAttribute('aria-label')).toBe('Week of 28 Sep, 3 of 4 workouts')
    expect(cells().map(c => c.classList.contains('on'))).toEqual([false, false, false, true])
    expect(cells().map(c => c.tagName)).toEqual(Array(4).fill('SPAN'))
  })

  it('a week with a handler is a button, the active one marked current; with a link a link', () => {
    const onClick = vi.fn()
    view.render(<WeekStrip4 weeks={WEEKS.map(w => ({ ...w, onClick }))} active={2} />)
    const buttons = view.host.querySelectorAll('button.g-w4-cell')
    expect(buttons).toHaveLength(4)
    expect(buttons[2].getAttribute('aria-current')).toBe('page')
    expect(buttons[0].getAttribute('aria-current')).toBeNull()
    click(buttons[0])
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<WeekStrip4 weeks={WEEKS.map(w => ({ ...w, href: '#/w' }))} />)
    expect(view.host.querySelectorAll('a.g-w4-cell')).toHaveLength(4)
  })

  it('a week with nothing planned says how many workouts, never "0 of 0"; never more than four weeks', () => {
    view.render(<WeekStrip4 weeks={[...WEEKS, { key: 'e', label: '19 Oct', done: 0, planned: 0 }].slice(1)} />)
    expect(cells()).toHaveLength(4)
    expect(cells()[3].querySelectorAll('.g-w4-bars i')).toHaveLength(0)
    expect(cells()[3].querySelector('.g-w4-n').textContent).toBe('0 workouts')
    expect(cells()[3].getAttribute('aria-label')).toBe('Week of 19 Oct, 0 workouts')
    view.render(<WeekStrip4 weeks={[...WEEKS, { key: 'e', label: '19 Oct', done: 0, planned: 0 }]} />)
    expect(cells()).toHaveLength(4)
  })

  it('a week with no plan to hold it to (planned null) lights a bar a workout', () => {
    view.render(<WeekStrip4 weeks={[{ key: 'a', label: '21 Sep', done: 2, planned: null }]} />)
    expect(cells()[0].querySelectorAll('.g-w4-bars i.on')).toHaveLength(2)
    expect(cells()[0].querySelector('.g-w4-n').textContent).toBe('2 workouts')
  })

  it('counts through the plural forms: one planned workout reads in the singular', () => {
    view.render(<WeekStrip4 weeks={[{ key: 'a', label: '21 Sep', done: 1, planned: 1 }]} />)
    expect(cells()[0].getAttribute('aria-label')).toBe('Week of 21 Sep, 1 of 1 workout')
  })
})
