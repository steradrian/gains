// @vitest-environment happy-dom
// BarChart: rounded bars with short labels, one at full strength, an optional target line. The kit
// formats nothing: the spoken summary is the caller's.
import { describe, expect, it } from 'vitest'
import BarChart from './BarChart.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const bars = () => [...view.host.querySelectorAll('.g-bar-col i')]

describe('BarChart', () => {
  it('draws a bar a value, scaled to the tallest, with the caller\'s labels under them', () => {
    view.render(<BarChart values={[5, 10, 0]} labels={['W1', 'W2', 'W3']} height={100} label="Volume by week" />)
    expect(bars().map(b => b.style.height)).toEqual(['50px', '100px', '3px'])
    expect([...view.host.querySelectorAll('.g-bar small')].map(s => s.textContent)).toEqual(['W1', 'W2', 'W3'])
  })

  it('is one image named by the caller when there is no per-bar text', () => {
    view.render(<BarChart values={[1, 2]} label="Volume by week: 1 t, then 2 t" />)
    const chart = view.host.querySelector('.g-chart')
    expect(chart.getAttribute('role')).toBe('img')
    expect(chart.getAttribute('aria-label')).toBe('Volume by week: 1 t, then 2 t')
    expect(view.host.querySelector('.g-sr')).toBeNull()
  })

  it('with barLabels it is a group with a hidden list, and the drawn bars are left out of the tree', () => {
    view.render(<BarChart values={[1, 2]} barLabels={['Week 1: 1 t', 'Week 2: 2 t']} label="Volume by week" />)
    const chart = view.host.querySelector('.g-chart')
    expect(chart.getAttribute('role')).toBe('group')
    expect([...view.host.querySelectorAll('.g-sr li')].map(li => li.textContent)).toEqual(['Week 1: 1 t', 'Week 2: 2 t'])
    expect(view.host.querySelector('.g-bars').getAttribute('aria-hidden')).toBe('true')
  })

  it('draws one bar at full strength and dims the rest', () => {
    view.render(<BarChart values={[1, 2, 3]} highlight={2} label="x" />)
    expect(bars().map(b => b.classList.contains('g-bar-dim'))).toEqual([true, true, false])
    view.render(<BarChart values={[1, 2, 3]} label="x" />)
    expect(bars().some(b => b.classList.contains('g-bar-dim'))).toBe(false)
  })

  it('draws the target line, and a target above the bars makes room for it', () => {
    view.render(<BarChart values={[5]} target={10} height={100} label="x" />)
    const line = view.host.querySelector('.g-bars-target')
    expect(line.style.bottom).toBe('120px')
    expect(bars()[0].style.height).toBe('50px')
    view.render(<BarChart values={[5]} height={100} label="x" />)
    expect(view.host.querySelector('.g-bars-target')).toBeNull()
  })

  it('draws a tick across each bar that has its own target, and none across one without', () => {
    view.render(<BarChart values={[5, 5, 5]} targets={[10, null, 5]} height={100} label="x" />)
    const ticks = [...view.host.querySelectorAll('.g-bar-tick')]
    expect(ticks.map(t => t.style.bottom)).toEqual(['100px', '50px'])
    expect(bars()[0].style.height).toBe('50px')
    expect(view.host.querySelector('.g-bars-target')).toBeNull()
  })

  it('takes a color, is white by default, glass on the stage, and refuses another tone', () => {
    view.render(<BarChart values={[1]} color="red" label="x" />)
    expect(view.host.querySelector('.g-chart').style.getPropertyValue('--g-bar')).toBe('red')
    expect(view.host.querySelector('.g-chart-stage')).toBeNull()
    view.render(<BarChart tone="stage" values={[1]} label="x" />)
    expect(view.host.querySelector('.g-chart-stage')).not.toBeNull()
    expect(view.host.querySelector('.g-chart').classList.contains('g-glass')).toBe(true)
    expect(() => view.render(<BarChart tone="dark" values={[1]} label="x" />)).toThrow(/tone="dark"/)
  })

  it('draws without bars', () => {
    view.render(<BarChart values={[]} label="x" />)
    expect(bars()).toHaveLength(0)
  })
})
