// @vitest-environment happy-dom
// MonthGrid: a month on the stage. The kit has no calendar maths and no copy: the caller gives the
// title, the weekday letters, the blanks before day 1 and every spoken name.
import { describe, expect, it, vi } from 'vitest'
import MonthGrid from './MonthGrid.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const cells = () => [...view.host.querySelectorAll('.g-mg-cell')]
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const day = (n, extra) => ({ day: n, iso: `2026-10-${String(n).padStart(2, '0')}`, ...extra })

describe('MonthGrid', () => {
  it('draws the title, the weekday letters the caller gave, and blanks before day 1', () => {
    view.render(<MonthGrid title="October 2026" weekdays={WEEKDAYS} offset={3} days={[day(1), day(2), day(3)]} />)
    expect(view.host.querySelector('.g-mg-top b').textContent).toBe('October 2026')
    expect(view.host.querySelector('.g-mg').getAttribute('aria-label')).toBe('October 2026')
    expect([...view.host.querySelectorAll('.g-mg-head')].map(h => h.textContent)).toEqual(WEEKDAYS)
    const grid = view.host.querySelector('.g-mg-grid')
    // 7 heads, 3 blanks, 3 days
    expect(grid.children).toHaveLength(13)
    expect(grid.children[7].className).toBe('')
    expect(cells()).toHaveLength(3)
  })

  it('a day with a value has a ring and one without is dimmed and has none', () => {
    view.render(<MonthGrid title="x" days={[day(1, { value: 1 }), day(2, { value: 0.4 }), day(3, { value: 1.4 }), day(4)]} />)
    const rings = cells().map(c => c.querySelector('.g-mring-val'))
    expect(rings[0]).not.toBeNull()
    expect(rings[2].classList.contains('g-mring-over')).toBe(true)
    expect(rings[3]).toBeNull()
    expect(cells()[3].querySelector('.g-mg-future')).not.toBeNull()
    expect(cells()[0].querySelector('.g-mg-future')).toBeNull()
  })

  it('days are buttons only with onDay and an iso, named by the caller, and open that day', () => {
    const onDay = vi.fn()
    view.render(<MonthGrid title="x" onDay={onDay} days={[day(1, { label: 'Thu 1 Oct, 1 workout' }), { day: 2 }, day(3)]} />)
    expect(view.host.querySelectorAll('button.g-mg-cell')).toHaveLength(2)
    expect(cells()[0].getAttribute('aria-label')).toBe('Thu 1 Oct, 1 workout')
    expect(cells()[1].tagName).toBe('SPAN')
    expect(cells()[2].getAttribute('aria-label')).toBe('3')
    click(cells()[0])
    expect(onDay).toHaveBeenCalledWith('2026-10-01')
  })

  it('without onDay nothing is a button, and a day can still be a link or have its own handler', () => {
    const onClick = vi.fn()
    view.render(<MonthGrid title="x" days={[day(1), day(2, { href: '#/day/2' }), day(3, { onClick })]} />)
    expect(cells().map(c => c.tagName)).toEqual(['SPAN', 'A', 'BUTTON'])
    expect(cells()[1].getAttribute('href')).toBe('#/day/2')
    click(cells()[2])
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('lights today', () => {
    view.render(<MonthGrid title="x" today={2} days={[day(1), day(2)]} />)
    expect(cells().map(c => c.classList.contains('g-mg-on'))).toEqual([false, true])
    expect(cells()[1].getAttribute('aria-current')).toBe('date')
  })

  it('has arrows named by the caller; a missing handler disables that arrow', () => {
    const onPrev = vi.fn()
    view.render(<MonthGrid title="x" days={[]} onPrev={onPrev} prevLabel="Previous month" nextLabel="Next month" />)
    const [prev, next] = view.host.querySelectorAll('.g-mg-nav')
    expect(prev.getAttribute('aria-label')).toBe('Previous month')
    expect([prev, next].map(b => [b.getAttribute('data-glass'), b.classList.contains('g-glass')])).toEqual([['control', false], ['control', false]])
    expect(next.getAttribute('aria-label')).toBe('Next month')
    expect(prev.disabled).toBe(false)
    expect(next.disabled).toBe(true)
    click(prev)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })

  it('draws the legend the caller gave, a ring a line', () => {
    view.render(<MonthGrid title="x" days={[]} legend={[{ label: 'Trained', value: 1 }, { label: 'Planned', value: 0 }]} />)
    const items = [...view.host.querySelectorAll('.g-mg-legend span')]
    expect(items.map(s => s.textContent)).toEqual(['Trained', 'Planned'])
    expect(items[0].querySelector('.g-mring-val')).not.toBeNull()
    expect(items[1].querySelector('.g-mring-val')).toBeNull()
    view.render(<MonthGrid title="x" days={[]} />)
    expect(view.host.querySelector('.g-mg-legend')).toBeNull()
  })
})
