// @vitest-environment happy-dom
// LoopStrip: the loop's routines as chips in order, the next one lit and the done ones ticked,
// each said by the caller's label; the line under them, an empty line, and one text action.
import { describe, expect, it, vi } from 'vitest'
import LoopStrip from './LoopStrip.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const ITEMS = [
  { id: 'a', n: 1, name: 'Push A', state: 'done', label: '1. Push A, Done' },
  { id: 'b', n: 2, name: 'Pull A', state: 'next', label: '2. Pull A, Up next' },
  { id: 'c', n: 3, name: 'Legs', state: 'later', label: '3. Legs, Later' },
]
const chips = () => [...view.host.querySelectorAll('.g-loop-chip')]

describe('LoopStrip', () => {
  it('a titled card of chips in order, said by their labels, with chevrons between', () => {
    view.render(<LoopStrip title="Your loop" line="3 workouts, then repeat" items={ITEMS} note="A missed day moves the loop forward; nothing is lost." />)
    expect(view.host.querySelector('h2').textContent).toBe('Your loop')
    expect(view.host.querySelector('.g-loop-line').textContent).toBe('3 workouts, then repeat')
    expect(view.host.querySelector('ol').children).toHaveLength(3)
    expect(chips().every(c => c.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect([...view.host.querySelectorAll('.sr-only')].map(e => e.textContent)).toEqual(ITEMS.map(i => i.label))
    expect(view.host.querySelectorAll('.g-loop-sep')).toHaveLength(2)
    expect(view.host.querySelector('.g-loop-note').textContent).toBe('A missed day moves the loop forward; nothing is lost.')
  })

  it('lights the next one, ticks the done one and numbers the rest', () => {
    view.render(<LoopStrip title="Your loop" items={ITEMS} />)
    expect(chips()[0].className).toContain('done')
    expect(chips()[0].querySelector('.g-icon')).not.toBeNull()
    expect(chips()[1].className).toContain('on')
    expect(chips()[1].textContent).toBe('2Pull A')
    view.render(<LoopStrip title="Your week" items={ITEMS.map(i => ({ ...i, state: null }))} numbered={false} />)
    expect(chips()[1].textContent).toBe('Pull A')
  })

  it('says the empty line with no chips, and its action is a pressable button', () => {
    const onClick = vi.fn()
    view.render(<LoopStrip title="Your loop" items={[]} empty="No rotation yet" action={{ label: 'Edit', onClick, pressed: false }} />)
    expect(view.host.querySelector('ol')).toBeNull()
    expect(view.host.querySelector('.g-loop-empty').textContent).toBe('No rotation yet')
    const act = view.host.querySelector('.g-loop-act')
    expect(act.getAttribute('aria-pressed')).toBe('false')
    click(act)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
