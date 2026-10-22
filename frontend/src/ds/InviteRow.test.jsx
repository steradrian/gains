// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import Button from './Button.jsx'
import InviteRow from './InviteRow.jsx'
import Tag from './Tag.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('InviteRow', () => {
  it('shows the name and the line under it', () => {
    view.render(<InviteRow title="Mara" line="Waiting · expires Thu 22 Oct" />)
    expect(view.host.querySelector('b').textContent).toBe('Mara')
    expect(view.host.querySelector('.g-grow-k').textContent).toBe('Waiting · expires Thu 22 Oct')
  })

  it('is a card with no button when it has no action', () => {
    view.render(<InviteRow title="Radu" line="Joined Mon 5 Oct" />)
    expect(view.host.querySelector('.g-grow').tagName).toBe('DIV')
    expect(view.host.querySelector('button, a')).toBeNull()
  })

  it('is one button, with a chevron, when it opens something', () => {
    const onClick = vi.fn()
    view.render(<InviteRow title="Mara" line="Waiting" onClick={onClick} />)
    const row = view.host.querySelector('.g-grow')
    expect(row.tagName).toBe('BUTTON')
    expect(row.querySelector('.g-trail-sm')).not.toBeNull()
    click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('takes a Tag in place of the chevron and stays one button', () => {
    view.render(<InviteRow title="Andrei" line="Waiting" trailing={<Tag tone="glass">New</Tag>} onClick={() => {}} />)
    expect(view.host.querySelector('.g-tag').textContent).toBe('New')
    expect(view.host.querySelectorAll('button')).toHaveLength(1)
  })

  it('takes a Button at the end whose tap is the only one', () => {
    const onClick = vi.fn()
    view.render(<InviteRow title="Vlad" line="Expired" trailing={<Button size="sm" variant="glass" onClick={onClick}>New link</Button>} />)
    expect(view.host.querySelector('.g-grow').tagName).toBe('DIV')
    click(view.host.querySelector('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
