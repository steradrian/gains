// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import Button from './Button.jsx'
import ChangeRow from './ChangeRow.jsx'
import Tag from './Tag.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('ChangeRow', () => {
  it('shows the title, the detail line and a Button at the end that answers a tap', () => {
    const onClick = vi.fn()
    view.render(<ChangeRow title="Deleted Oats with milk" detail="Breakfast, Sun 18 Oct · 380 kcal · 09:12"
      trailing={<Button size="sm" variant="glass" onClick={onClick}>Restore</Button>} />)
    expect(view.host.querySelector('b').textContent).toBe('Deleted Oats with milk')
    expect(view.host.querySelector('.g-grow-k').textContent).toBe('Breakfast, Sun 18 Oct · 380 kcal · 09:12')
    // The row is a card, not a button: the only thing to tap is the control.
    expect(view.host.querySelector('.g-grow').tagName).toBe('DIV')
    click(view.host.querySelector('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('takes a Tag in the same place, with no button left', () => {
    view.render(<ChangeRow title="Changed a weigh-in" detail="08:05" trailing={<Tag tone="glass">Restored</Tag>} />)
    expect(view.host.querySelector('.g-tag').textContent).toBe('Restored')
    expect(view.host.querySelector('button')).toBeNull()
  })

  it('leaves the detail line out when there is none', () => {
    view.render(<ChangeRow title="Changed something" />)
    expect(view.host.querySelector('.g-grow-k')).toBeNull()
  })
})
