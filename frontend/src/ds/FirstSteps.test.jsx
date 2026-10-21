// @vitest-environment happy-dom
// FirstSteps (board T1.9): a step to do goes somewhere; a done one ticks, is struck through and
// only said.
import { describe, expect, it, vi } from 'vitest'
import FirstSteps from './FirstSteps.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const steps = () => [...view.host.querySelectorAll('.g-fstep')]

describe('FirstSteps', () => {
  it('lists the steps in order, the done one ticked and struck and the rest with a chevron', () => {
    view.render(
      <FirstSteps steps={[
        { title: 'Set your goal', sub: 'Done in onboarding', done: true },
        { title: 'Log your first meal', sub: 'Takes about 20 seconds', href: '#/log' },
        { title: 'Weigh in', sub: 'Starts your trend', onClick: () => {} },
      ]} />,
    )
    expect(view.host.querySelector('ol')).not.toBeNull()
    expect(steps().map(s => s.classList.contains('done'))).toEqual([true, false, false])
    expect(steps()[0].querySelector('.g-fstep-dot.on svg')).not.toBeNull()
    expect(steps()[0].querySelector('.g-fstep-chev')).toBeNull()
    expect(steps()[1].querySelector('.g-fstep-chev')).not.toBeNull()
    expect(steps()[1].querySelector('.g-fstep-dot.on')).toBeNull()
  })

  it('a step to do is a link or a button and calls its handler', () => {
    const onClick = vi.fn()
    view.render(<FirstSteps steps={[{ title: 'Log', href: '#/log' }, { title: 'Weigh in', onClick }]} />)
    const rows = [...view.host.querySelectorAll('.g-fstep-row')]
    expect(rows.map(r => r.tagName)).toEqual(['A', 'BUTTON'])
    click(rows[1])
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('a done step is not tappable even with a handler, and says Done to a screen reader', () => {
    view.render(<FirstSteps steps={[{ title: 'Set your goal', done: true, href: '#/goal' }]} />)
    expect(view.host.querySelector('button, a')).toBeNull()
    expect(view.host.querySelector('.g-sr').textContent).toBe('Done: ')
  })

  it('a step with nowhere to go is only said', () => {
    view.render(<FirstSteps steps={[{ title: 'Soon', sub: 'Not yet' }]} />)
    expect(view.host.querySelector('button, a, .g-fstep-chev')).toBeNull()
  })
})
