// @vitest-environment happy-dom
// MusclesCard (board T2.0): the week's muscles front and back, what is not trained yet, and the
// way to Training load.
import { describe, expect, it, vi } from 'vitest'
import MusclesCard from './MusclesCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const card = () => view.host.querySelector('.g-mcard')

describe('MusclesCard', () => {
  it('the title, the period, the map, the line and the link word', () => {
    view.render(<MusclesCard title="Muscles this week" period="Week of 12 Oct" levels={{ chest: 4 }} note="Legs not trained yet" action="Training load" onClick={() => {}} />)
    expect(card().classList.contains('g-glass')).toBe(true)
    expect(card().querySelector('.g-mcard-head b').textContent).toBe('Muscles this week')
    expect(card().querySelector('.g-mcard-head span').textContent).toBe('Week of 12 Oct')
    expect(card().querySelector('.g-bmap')).not.toBeNull()
    expect(card().querySelector('.g-mcard-foot').textContent).toBe('Legs not trained yet' + 'Training load')
    expect(card().querySelector('.g-mcard-act svg')).not.toBeNull()
  })

  it('the whole card is the tap', () => {
    const go = vi.fn()
    view.render(<MusclesCard title="Muscles this week" onClick={go} />)
    expect(card().tagName).toBe('BUTTON')
    click(card())
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('with href a link, with neither just said', () => {
    view.render(<MusclesCard title="Muscles this week" href="#/progress/load" />)
    expect(card().tagName).toBe('A')
    view.render(<MusclesCard title="Muscles this week" />)
    expect(card().tagName).toBe('DIV')
  })
})
