// @vitest-environment happy-dom
// AwayCard (board T1.10): one message and up to two buttons, the solid one white.
import { describe, expect, it, vi } from 'vitest'
import AwayCard from './AwayCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const buttons = () => [...view.host.querySelectorAll('.g-away-btn')]

describe('AwayCard', () => {
  it('says a title and a body with a hand by default', () => {
    view.render(<AwayCard title="Welcome back" body="8 days since your last log." />)
    expect(view.host.querySelector('.g-away-body').textContent).toBe('Welcome back8 days since your last log.')
    expect(view.host.querySelector('.g-away-ic svg')).not.toBeNull()
    expect(view.host.querySelector('.g-away-acts')).toBeNull()
  })

  it('draws the solid action white and the other glass, and calls each handler', () => {
    const weigh = vi.fn()
    const later = vi.fn()
    view.render(<AwayCard title="Welcome back" actions={[{ label: 'Weigh in', solid: true, onClick: weigh }, { label: 'Not now', onClick: later }]} />)
    expect(buttons().map(b => b.textContent)).toEqual(['Weigh in', 'Not now'])
    expect(buttons().map(b => b.classList.contains('g-away-solid'))).toEqual([true, false])
    expect(buttons().map(b => b.classList.contains('g-glass'))).toEqual([false, true])
    click(buttons()[1])
    expect(later).toHaveBeenCalledTimes(1)
    expect(weigh).not.toHaveBeenCalled()
  })

  it('an action with an href is a link', () => {
    view.render(<AwayCard title="Welcome back" actions={[{ label: 'See changes', href: '#/plan' }]} />)
    expect(buttons()[0].tagName).toBe('A')
  })
})
