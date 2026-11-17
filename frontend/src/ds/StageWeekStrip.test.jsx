// @vitest-environment happy-dom
// StageWeekStrip: the seven days by name, the lit ones a white disc with a dumbbell, lit in order.
import { describe, expect, it } from 'vitest'
import StageWeekStrip from './StageWeekStrip.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

describe('StageWeekStrip', () => {
  it('names every day and lights the ones given, each one after the last', () => {
    view.render(<StageWeekStrip days={NAMES.map((label, i) => ({ key: label, label, lit: [0, 1, 3, 4].includes(i) }))} />)
    const strip = view.host.firstElementChild
    expect(strip.getAttribute('aria-hidden')).toBe('true')
    const days = [...strip.querySelectorAll('.g-week-d')]
    expect(days.map(d => d.textContent)).toEqual(NAMES)
    const discs = days.map(d => d.querySelector('.g-week-disc'))
    expect(discs.map(d => d.classList.contains('on'))).toEqual([true, true, false, true, true, false, false])
    expect(discs.map(d => !!d.querySelector('[data-icon="dumbbell"]'))).toEqual([true, true, false, true, true, false, false])
    expect(discs.filter(d => d.classList.contains('on')).map(d => d.style.getPropertyValue('--k'))).toEqual(['0', '1', '2', '3'])
  })

  it('lights nothing for a week with no training', () => {
    view.render(<StageWeekStrip days={NAMES.map(label => ({ key: label, label, lit: false }))} />)
    expect(view.host.querySelectorAll('.g-week-disc.on')).toHaveLength(0)
  })
})
