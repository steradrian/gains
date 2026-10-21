// @vitest-environment happy-dom
// PlanWeekGrid: two weeks of tappable days under the weekday letters. Each cell is a button named
// by the caller, drawn by its state, with the date and what it holds; a tap hands back its date.
import { describe, expect, it, vi } from 'vitest'
import PlanWeekGrid from './PlanWeekGrid.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const day = (iso, state, short, extra = {}) => ({ iso, date: Number(iso.slice(8)), state, short, label: `${iso}, ${short}`, ...extra })
const WEEKS = [
  { title: 'This week', days: [day('2026-10-12', 'done', 'Push A'), day('2026-10-13', 'rest', 'Rest'), day('2026-10-14', 'missed', 'Pull A'), day('2026-10-15', 'noted', 'Rest'),
    day('2026-10-16', 'rest', 'Rest'), day('2026-10-17', 'rest', 'Rest'), day('2026-10-18', 'planned', 'Push A', { today: true })] },
  { title: 'Next week', days: Array.from({ length: 7 }, (_, i) => day('2026-10-' + (19 + i), i % 2 ? 'rest' : 'planned', i % 2 ? 'Rest' : 'Legs')) },
]
const cells = () => [...view.host.querySelectorAll('.g-pcell')]

describe('PlanWeekGrid', () => {
  it('draws the letters, a title per week and fourteen buttons named by the caller', () => {
    view.render(<PlanWeekGrid weeks={WEEKS} dows={['M', 'T', 'W', 'T', 'F', 'S', 'S']} />)
    expect([...view.host.querySelectorAll('.g-pgrid-dow')].map(e => e.textContent).join('')).toBe('MTWTFSS')
    expect(view.host.querySelector('.g-pgrid-dow').getAttribute('aria-hidden')).toBe('true')
    expect([...view.host.querySelectorAll('.g-pgrid-week')].map(e => e.textContent)).toEqual(['This week', 'Next week'])
    expect(cells()).toHaveLength(14)
    expect(cells().every(c => c.tagName === 'BUTTON')).toBe(true)
    expect(cells()[0].getAttribute('aria-label')).toBe('2026-10-12, Push A')
    expect(cells()[0].textContent).toBe('12Push A')
  })

  it('draws each state, ticks a done day, crosses a missed one and rings today', () => {
    view.render(<PlanWeekGrid weeks={WEEKS} dows={[]} />)
    expect(cells()[0].className).toContain('g-pcell-done')
    expect(cells()[0].querySelector('.g-icon')).not.toBeNull()
    expect(cells()[1].className).toContain('g-pcell-rest')
    expect(cells()[1].querySelector('.g-icon')).toBeNull()
    expect(cells()[2].className).toContain('g-pcell-missed')
    expect(cells()[3].className).toContain('g-pcell-noted')
    expect(cells()[6].className).toContain('today')
    expect(cells().filter(c => c.className.includes('today'))).toHaveLength(1)
  })

  it('a tap hands back the day', () => {
    const onPick = vi.fn()
    view.render(<PlanWeekGrid weeks={WEEKS} dows={[]} onPick={onPick} />)
    click(cells()[9])
    expect(onPick).toHaveBeenCalledWith('2026-10-21')
  })
})
