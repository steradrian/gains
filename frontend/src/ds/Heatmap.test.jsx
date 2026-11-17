// @vitest-environment happy-dom
// Heatmap: days shaded by level. A day is a button only when the page can open it; the kit has no
// copy, so the names come from the caller.
import { describe, expect, it, vi } from 'vitest'
import Heatmap from './Heatmap.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const cells = () => [...view.host.querySelectorAll('.g-heat-c')]
const days = n => Array.from({ length: n }, (_, i) => ({ iso: '2026-10-' + String(i + 1).padStart(2, '0'), label: `${i + 1} Oct, ${i} min` }))

describe('Heatmap', () => {
  it('shades each day by its level, the DS way: three shades, clamped', () => {
    view.render(<Heatmap values={[0, 1, 2, 7]} cols={2} label="Training, last 2 weeks" />)
    expect(cells().map(c => [...c.classList].find(k => /^g-heat-\d$/.test(k)))).toEqual(['g-heat-0', 'g-heat-1', 'g-heat-2', 'g-heat-2'])
    expect(view.host.querySelector('.g-heat-grid').getAttribute('style')).toContain('repeat(2, minmax(0, 1fr))')
  })

  it('with five shades it keeps all five', () => {
    view.render(<Heatmap values={[0, 1, 2, 3, 4, 9]} levels={5} label="x" />)
    expect(cells().map(c => [...c.classList].find(k => /^g-heat-\d$/.test(k)))).toEqual(['g-heat-0', 'g-heat-1', 'g-heat-2', 'g-heat-3', 'g-heat-4', 'g-heat-4'])
    expect(view.host.querySelector('.g-heat-n5')).not.toBeNull()
  })

  it('without onDay it is one image named by the caller and has no buttons', () => {
    view.render(<Heatmap values={[0, 1]} days={days(2)} label="Training calendar" />)
    const root = view.host.querySelector('.g-heat')
    expect(root.getAttribute('role')).toBe('img')
    expect(root.getAttribute('aria-label')).toBe('Training calendar')
    expect(view.host.querySelector('button')).toBeNull()
  })

  it('with onDay a day that has an iso is a button named by the caller, and opens that day', () => {
    const onDay = vi.fn()
    const d = days(3)
    d[1] = { label: '2 Oct, nothing' }   // a day with nothing to open has no iso
    view.render(<Heatmap values={[1, 0, 2]} days={d} onDay={onDay} label="Training calendar" />)
    expect(view.host.querySelector('.g-heat').getAttribute('role')).toBe('group')
    const buttons = [...view.host.querySelectorAll('button.g-heat-c')]
    expect(buttons).toHaveLength(2)
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['1 Oct, 0 min', '3 Oct, 2 min'])
    click(buttons[1])
    expect(onDay).toHaveBeenCalledWith('2026-10-03')
    expect(cells()[1].tagName).toBe('I')
  })

  it('marks today, future and noted days', () => {
    view.render(<Heatmap values={[0, 0, 0]} days={[{ today: true }, { future: true }, { noted: true }]} label="x" />)
    expect(cells().map(c => [c.classList.contains('g-heat-today'), c.classList.contains('g-heat-future'), c.classList.contains('g-heat-noted')]))
      .toEqual([[true, false, false], [false, true, false], [false, false, true]])
  })

  it('a year is a column a week, with the caller\'s month labels over their weeks', () => {
    view.render(<Heatmap byWeek values={Array(21).fill(0)} months={[{ week: 0, label: 'Sep' }, { week: 2, label: 'Oct' }]} label="x" />)
    expect(view.host.querySelector('.g-heat-weeks')).not.toBeNull()
    const months = [...view.host.querySelectorAll('.g-heat-months span')]
    expect(months.map(m => m.textContent)).toEqual(['Sep', 'Oct'])
    expect(months.map(m => m.getAttribute('style'))).toEqual(['grid-column-start: 1;', 'grid-column-start: 3;'])
    expect(view.host.querySelector('.g-heat-months').getAttribute('aria-hidden')).toBe('true')
    expect(view.host.querySelector('.g-heat-grid').getAttribute('style')).toBeNull()
  })

  it('draws the legend the caller words, one swatch a shade, hidden from a screen reader', () => {
    view.render(<Heatmap values={[0]} levels={5} legend={{ less: 'Less time', more: 'More time' }} label="x" />)
    const legend = view.host.querySelector('.g-heat-legend')
    expect(legend.textContent).toBe('Less timeMore time')
    expect(legend.querySelectorAll('i[aria-hidden="true"]')).toHaveLength(5)
  })

  it('is a card by default, glass on the stage, and refuses another tone or shade count', () => {
    view.render(<Heatmap values={[0]} label="x" />)
    expect(view.host.querySelector('.g-heat-stage')).toBeNull()
    view.render(<Heatmap tone="stage" values={[0]} label="x" />)
    expect(view.host.querySelector('.g-heat-stage')).not.toBeNull()
    expect(view.host.querySelector('.g-heat').classList.contains('g-glass')).toBe(true)
    expect(() => view.render(<Heatmap tone="dark" values={[]} label="x" />)).toThrow(/tone="dark"/)
    expect(() => view.render(<Heatmap levels={4} values={[]} label="x" />)).toThrow(/levels=4/)
  })
})
