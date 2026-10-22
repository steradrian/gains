// @vitest-environment happy-dom
// LineChart: one line, its latest point marked, a readout under the finger, and the points as a
// list for a screen reader. The kit formats nothing: every sentence comes from the caller.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LineChart from './LineChart.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const items = () => [...view.host.querySelectorAll('.g-sr li')].map(li => li.textContent)

// happy-dom lays nothing out, so the plot is given a 300px box starting at x=0
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 150, right: 300, bottom: 150, x: 0, y: 0, toJSON: () => ({}) })
})
afterEach(() => { vi.restoreAllMocks() })

const move = (el, clientX) => act(() => { el.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX })) })

describe('LineChart', () => {
  it('is named by the caller and lists every point, as the caller wrote it', () => {
    view.render(<LineChart values={[90, 92, 96]} pointLabels={['Thu 1 Oct: 90 kg', 'Thu 8 Oct: 92 kg', 'Mon 12 Oct: 96 kg']} label="Estimated 1RM: 90 kg on 1 Oct, 96 kg on 12 Oct" />)
    const chart = view.host.querySelector('.g-chart')
    expect(chart.getAttribute('role')).toBe('group')
    expect(chart.getAttribute('aria-label')).toBe('Estimated 1RM: 90 kg on 1 Oct, 96 kg on 12 Oct')
    expect(view.host.querySelector('svg').getAttribute('aria-hidden')).toBe('true')
    expect(items()).toEqual(['Thu 1 Oct: 90 kg', 'Thu 8 Oct: 92 kg', 'Mon 12 Oct: 96 kg'])
  })

  it('without point labels a point is its number and the unit, unformatted', () => {
    view.render(<LineChart values={[1, 2]} unit="kg" label="x" />)
    expect(items()).toEqual(['1 kg', '2 kg'])
  })

  it('thins a long series to 62 points and keeps the last', () => {
    const values = Array.from({ length: 365 }, (_, i) => i)
    view.render(<LineChart values={values} label="x" />)
    expect(items().length).toBeLessThanOrEqual(63)
    expect(items().at(-1)).toBe('364')
    expect(items()[0]).toBe('0')
  })

  it('marks the latest point and draws the axis labels the caller gave', () => {
    view.render(<LineChart values={[1, 3, 2]} labels={['Jul', 'Aug', 'Sep']} label="x" />)
    const dot = view.host.querySelector('.g-lc-dot')
    expect(dot.style.left).toBe('100%')
    expect([...view.host.querySelectorAll('.g-lc-x span')].map(s => s.textContent)).toEqual(['Jul', 'Aug', 'Sep'])
    expect(view.host.querySelector('.g-lc-x').getAttribute('aria-hidden')).toBe('true')
  })

  it('shows the nearest point under the pointer and clears it on leave', () => {
    view.render(<LineChart values={[10, 20, 30]} pointLabels={['a: 10', 'b: 20', 'c: 30']} label="x" />)
    const plot = view.host.querySelector('.g-lc-plot')
    expect(view.host.querySelector('.g-lc-tip')).toBeNull()
    move(plot, 160)
    expect(view.host.querySelector('.g-lc-tip').textContent).toBe('b: 20')
    expect(view.host.querySelectorAll('.g-lc-dot')).toHaveLength(2)
    move(plot, 290)
    expect(view.host.querySelector('.g-lc-tip').textContent).toBe('c: 30')
    // React hears "leave" from the pointer going out to nothing
    act(() => { plot.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: null })) })
    expect(view.host.querySelector('.g-lc-tip')).toBeNull()
  })

  it('draws one point and a flat series without dividing by zero', () => {
    view.render(<LineChart values={[5]} label="x" />)
    expect(view.host.querySelector('.g-lc-line')).toBeNull()
    expect(view.host.querySelector('.g-lc-dot')).not.toBeNull()
    view.render(<LineChart values={[5, 5, 5]} label="x" />)
    expect(view.host.querySelector('.g-lc-line').getAttribute('points')).not.toMatch(/NaN|Infinity/)
  })

  it('draws nothing for no points, so the page can say why', () => {
    view.render(<LineChart values={[]} label="x" />)
    expect(view.host.firstElementChild).toBeNull()
  })

  it('marks a point with a second reading: a dot per mark, bigger and more solid as it nears 1', () => {
    view.render(<LineChart values={[10, 12, 14]} marks={[0, null, 1]} label="x" />)
    const marks = [...view.host.querySelectorAll('.g-lc-mark')]
    expect(marks).toHaveLength(2)
    expect(marks[0].style.getPropertyValue('--g-m')).toBe('5px')
    expect(marks[1].style.getPropertyValue('--g-m')).toBe('11px')
    expect(Number(marks[0].style.getPropertyValue('--g-mo'))).toBeLessThan(Number(marks[1].style.getPropertyValue('--g-mo')))
    expect(marks[1].style.left).toBe('100%')
  })

  it('draws no mark dots without marks', () => {
    view.render(<LineChart values={[10, 12]} label="x" />)
    expect(view.host.querySelector('.g-lc-mark')).toBeNull()
  })

  it('draws a line per series instead of the single line, nested widest first, breaking at a gap', () => {
    view.render(<LineChart values={[30, 40, 50, 60]} label="x" series={[
      { values: [10, 20, 30, 40], color: 'blue' },
      { values: [5, null, 25, 35], color: 'green' },
    ]} />)
    expect(view.host.querySelector('.g-lc-line')).toBeNull()
    expect(view.host.querySelector('.g-lc-area')).toBeNull()
    expect(view.host.querySelector('.g-lc-dot')).toBeNull()
    const lines = [...view.host.querySelectorAll('.g-lc-series')]
    // the first series is one run; the second breaks at its null, and the 5 and the 25-35 pair remain
    expect(lines).toHaveLength(2)
    expect(lines[0].style.getPropertyValue('--g-s')).toBe('blue')
    expect(parseFloat(lines[0].style.getPropertyValue('--g-sw'))).toBeGreaterThan(parseFloat(lines[1].style.getPropertyValue('--g-sw')))
    expect(lines[0].getAttribute('points').split(' ')).toHaveLength(4)
    expect(lines[1].getAttribute('points').split(' ')).toHaveLength(2)
    // a dot for every point of every series, so a lone point shows
    expect(view.host.querySelectorAll('.g-lc-sdot')).toHaveLength(7)
  })

  it('keeps the readout on the anchoring values when there are series', () => {
    view.render(<LineChart values={[10, 20]} pointLabels={['a: 1', 'b: 2']} label="x" series={[{ values: [10, 20], color: 'blue' }, { values: [8, 15], color: 'green' }]} />)
    move(view.host.querySelector('.g-lc-plot'), 290)
    expect(view.host.querySelector('.g-lc-tip').textContent).toBe('b: 2')
    expect(items()).toEqual(['a: 1', 'b: 2'])
  })

  it('puts the smallest value at the top when inverted, at the bottom otherwise', () => {
    const latestTop = () => parseFloat(view.host.querySelector('.g-lc-dot').style.top)
    view.render(<LineChart values={[3, 0]} height={100} label="x" />)
    expect(latestTop()).toBe(90)
    view.render(<LineChart values={[3, 0]} height={100} invert label="x" />)
    expect(latestTop()).toBe(10)
    expect(view.host.querySelector('polyline').getAttribute('points')).toBe('0.0,90.0 326.0,10.0')
  })

  it('inverts the series lines with the rest of the chart', () => {
    const series = [{ values: [3, 0], color: 'blue' }]
    view.render(<LineChart values={[3, 0]} height={100} label="x" series={series} />)
    expect(view.host.querySelector('.g-lc-series').getAttribute('points')).toBe('0.0,10.0 326.0,90.0')
    view.render(<LineChart values={[3, 0]} height={100} invert label="x" series={series} />)
    expect(view.host.querySelector('.g-lc-series').getAttribute('points')).toBe('0.0,90.0 326.0,10.0')
  })

  it('is white by default, glass on the stage, and refuses another tone', () => {
    view.render(<LineChart values={[1, 2]} label="x" />)
    expect(view.host.firstElementChild.classList.contains('g-chart-stage')).toBe(false)
    view.render(<LineChart tone="stage" values={[1, 2]} label="x" />)
    expect(view.host.firstElementChild.classList.contains('g-chart-stage')).toBe(true)
    expect(view.host.firstElementChild.classList.contains('g-glass')).toBe(true)
    expect(() => view.render(<LineChart tone="dark" values={[1]} label="x" />)).toThrow(/tone="dark"/)
  })
})
