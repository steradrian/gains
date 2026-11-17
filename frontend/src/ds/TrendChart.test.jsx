// @vitest-environment happy-dom
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import TrendChart from './TrendChart.jsx'
import { useView } from './render.test-util.js'

const view = useView()

const POINTS = [{ d: '2026-09-06', v: 83.6 }, { d: '2026-09-13', v: 83.4 }, { d: '2026-10-18', v: 81.4 }]
const LABELS = ['6 Sep: 83.6 kg', '13 Sep: 83.4 kg', '18 Oct: 81.4 kg']

describe('TrendChart', () => {
  it('draws the line with the caller\'s label, and lists every point for a screen reader', () => {
    view.render(<TrendChart points={POINTS} pointLabels={LABELS} unit="kg" label="Weight over time" />)
    const chart = view.host.querySelector('.g-chart')
    expect(chart.getAttribute('role')).toBe('group')
    expect(chart.getAttribute('aria-label')).toBe('Weight over time')
    expect(chart.className).toContain('g-chart-stage')
    expect(chart.getAttribute('dir')).toBe('ltr')
    expect(view.host.querySelector('.g-lc-line')).not.toBeNull()
    expect([...view.host.querySelectorAll('.g-sr li')].map(li => li.textContent)).toEqual(LABELS)
  })

  it('reads a point without labels as its number and unit', () => {
    view.render(<TrendChart points={POINTS} unit="kg" label="Weight" />)
    expect([...view.host.querySelectorAll('.g-sr li')].map(li => li.textContent)).toEqual(['83.6 kg', '83.4 kg', '81.4 kg'])
  })

  it('places points by date: a long gap shows as a gap', () => {
    view.render(<TrendChart points={POINTS} unit="kg" label="Weight" />)
    const dots = view.host.querySelectorAll('.g-lc-dot')
    expect(dots).toHaveLength(1)
    expect(dots[0].style.left).toBe('100%')
    const pts = view.host.querySelector('.g-lc-line').getAttribute('points').split(' ').map(p => Number(p.split(',')[0]))
    // 7 of the 42 days to the second point, not a third of the way.
    expect(pts[1] / pts[2]).toBeCloseTo(7 / 42, 1)
  })

  it('draws a dashed target line with its caption, and counts it in the scale', () => {
    view.render(<TrendChart points={POINTS} target={78} targetCaption="Target 78 kg" unit="kg" label="Weight" />)
    expect(view.host.querySelector('.g-tc-target')).not.toBeNull()
    expect(view.host.querySelector('.g-tc-cap').textContent).toBe('Target 78 kg')
    // The target is the lowest value, so the line sits near the bottom of the plot.
    const y = Number(view.host.querySelector('.g-tc-target').getAttribute('y1'))
    expect(y).toBeGreaterThan(130)
  })

  it('has no target line without a target', () => {
    view.render(<TrendChart points={POINTS} unit="kg" label="Weight" />)
    expect(view.host.querySelector('.g-tc-target')).toBeNull()
    expect(view.host.querySelector('.g-tc-cap')).toBeNull()
  })

  it('names the axis dates the caller gives, inside the span only', () => {
    const axis = [{ d: '2026-09-06', text: '6 Sep' }, { d: '2026-10-04', text: '4 Oct' }, { d: '2026-10-18', text: '18 Oct' }, { d: '2026-11-30', text: '30 Nov' }]
    view.render(<TrendChart points={POINTS} axis={axis} unit="kg" label="Weight" />)
    const ticks = [...view.host.querySelectorAll('.g-tc-x span')]
    expect(ticks.map(s => s.textContent)).toEqual(['6 Sep', '4 Oct', '18 Oct'])
    expect(ticks[0].className).toBe('g-tc-first')
    expect(ticks[2].className).toBe('g-tc-last')
  })

  it('reads the nearest point by date on touch', () => {
    view.render(<TrendChart points={POINTS} pointLabels={LABELS} unit="kg" label="Weight" />)
    const plot = view.host.querySelector('.g-lc-plot')
    plot.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 160, right: 300, bottom: 160 })
    act(() => { plot.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 10 })) })
    expect(view.host.querySelector('.g-lc-tip').textContent).toBe('6 Sep: 83.6 kg')
    act(() => { plot.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 290 })) })
    expect(view.host.querySelector('.g-lc-tip').textContent).toBe('18 Oct: 81.4 kg')
    // React hears "leave" from the pointer going out to nothing
    act(() => { plot.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: null })) })
    expect(view.host.querySelector('.g-lc-tip')).toBeNull()
  })

  it('draws a lone weigh-in as a dot, and nothing for none', () => {
    view.render(<TrendChart points={POINTS.slice(-1)} unit="kg" label="Weight" />)
    expect(view.host.querySelector('.g-lc-line')).toBeNull()
    expect(view.host.querySelectorAll('.g-lc-dot')).toHaveLength(1)
    view.render(<TrendChart points={[]} unit="kg" label="Weight" />)
    expect(view.host.querySelector('.g-chart')).toBeNull()
  })

  it('refuses a tone the kit does not have, in development', () => {
    expect(() => view.render(<TrendChart points={POINTS} tone="loud" label="Weight" />)).toThrow(/tone="loud"/)
  })
})
