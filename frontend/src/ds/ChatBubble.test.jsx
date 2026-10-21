// @vitest-environment happy-dom
// ChatBubble: the Coach's line on glass, yours in white, the spoken sender and the time from the caller.
import { describe, expect, it } from 'vitest'
import ChatBubble from './ChatBubble.jsx'
import { useView } from './render.test-util.js'

const view = useView()
const bubble = () => view.host.querySelector('.g-bubble')

describe('ChatBubble', () => {
  it('draws the Coach’s line on glass at the start', () => {
    view.render(<ChatBubble text="Friday’s Legs didn’t happen." />)
    expect(bubble().classList.contains('g-bubble-them')).toBe(true)
    expect(bubble().classList.contains('g-glass')).toBe(true)
    expect(bubble().textContent).toBe('Friday’s Legs didn’t happen.')
  })

  it('draws your own line in white at the end', () => {
    view.render(<ChatBubble me text="Can we keep Sunday free?" />)
    expect(bubble().classList.contains('g-bubble-me')).toBe(true)
    expect(bubble().classList.contains('g-glass')).toBe(false)
  })

  it('says who wrote it, hidden, and shows the time the caller gives', () => {
    view.render(<ChatBubble me who="You" time="09:41" text="Hi" />)
    expect(bubble().querySelector('.g-sr').textContent).toBe('You')
    expect(bubble().querySelector('small').textContent).toBe('09:41')
  })

  it('has no sender or time of its own', () => {
    view.render(<ChatBubble text="Hi" />)
    expect(bubble().querySelector('.g-sr')).toBeNull()
    expect(bubble().querySelector('small')).toBeNull()
  })

  it('takes children instead of text, and tints a failure', () => {
    view.render(<ChatBubble error text="ignored"><ul><li>Build muscle</li></ul></ChatBubble>)
    expect(bubble().querySelector('li').textContent).toBe('Build muscle')
    expect(bubble().textContent).not.toContain('ignored')
    expect(bubble().classList.contains('g-bubble-error')).toBe(true)
  })
})
