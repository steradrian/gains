// @vitest-environment happy-dom
// DoneSetRows (boards W1.3, W1.8, W1.36): one glass row per done set, each a button named by the
// caller that opens the set to fix it.
import { describe, expect, it, vi } from 'vitest'
import DoneSetRows from './DoneSetRows.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const rows = () => [...view.host.querySelectorAll('.g-dsr-row')]

describe('DoneSetRows', () => {
  it('draws a row per set with its name and what was done, named by the caller\'s label', () => {
    view.render(
      <DoneSetRows rows={[
        { n: 1, name: 'Série 1', text: '80 kg × 8', label: '1, 80 kg × 8. Modifier' },
        { n: 2, name: 'Série 2', text: '80 kg × 7', label: '2, 80 kg × 7. Modifier' },
      ]}
      />,
    )
    expect(rows().map(r => r.querySelector('.g-dsr-n').textContent)).toEqual(['Série 1', 'Série 2'])
    expect(rows().map(r => r.querySelector('.g-dsr-v').textContent)).toEqual(['80 kg × 8', '80 kg × 7'])
    expect(rows().map(r => r.getAttribute('aria-label'))).toEqual(['1, 80 kg × 8. Modifier', '2, 80 kg × 7. Modifier'])
    expect(view.host.querySelector('.g-dsr').classList.contains('g-glass')).toBe(true)
  })

  it('each row is a button that calls its own onEdit', () => {
    const first = vi.fn()
    const second = vi.fn()
    view.render(
      <DoneSetRows rows={[
        { n: 1, name: 'Set 1', text: 'a', label: 'one', onEdit: first },
        { n: 2, name: 'Set 2', text: 'b', label: 'two', onEdit: second },
      ]}
      />,
    )
    expect(rows()[0].tagName).toBe('BUTTON')
    click(rows()[1])
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('a row with an href is a link', () => {
    view.render(<DoneSetRows rows={[{ n: 1, name: 'Set 1', text: 'a', label: 'one', href: '#/set/1' }]} />)
    expect(rows()[0].tagName).toBe('A')
    expect(rows()[0].getAttribute('href')).toBe('#/set/1')
  })

  it('a new best carries the caller\'s tag, and a plain row has none', () => {
    view.render(
      <DoneSetRows
        bestLabel="NOUVEAU RECORD"
        rows={[{ n: 1, name: 'Set 1', text: 'a', label: 'one' }, { n: 2, name: 'Set 2', text: 'b', label: 'two', best: true }]}
      />,
    )
    expect(rows()[0].querySelector('.g-dsr-best')).toBeNull()
    expect(rows()[1].querySelector('.g-dsr-best').textContent).toBe('NOUVEAU RECORD')
  })

  it('a warm-up row has the hollow tick', () => {
    view.render(<DoneSetRows rows={[{ n: 1, name: 'W', text: 'a', label: 'one', warmup: true }, { n: 2, name: 'Set 1', text: 'b', label: 'two' }]} />)
    expect(rows().map(r => r.classList.contains('g-dsr-warm'))).toEqual([true, false])
  })

  it('draws nothing for no rows', () => {
    view.render(<DoneSetRows rows={[]} />)
    expect(view.host.querySelector('.g-dsr')).toBeNull()
    view.render(<DoneSetRows />)
    expect(view.host.querySelector('.g-dsr')).toBeNull()
  })
})
