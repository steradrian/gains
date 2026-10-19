// @vitest-environment happy-dom
// Button: the stage's glass pill, and the busy state of a request in flight.
import { describe, expect, it, vi } from 'vitest'
import Button from './Button.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const button = () => view.host.querySelector('button')

describe('Button busy', () => {
  it('shows a spinner in place of the icon, says it is busy, and ignores taps', () => {
    const onClick = vi.fn()
    view.render(<Button busy icon="scanFace" onClick={onClick}>Waiting for your passkey</Button>)
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(button().querySelector('.g-spin')).not.toBeNull()
    expect(button().querySelector('svg')).toBeNull()
    expect(button().textContent).toBe('Waiting for your passkey')
    click(button())
    expect(onClick).not.toHaveBeenCalled()
  })

  it('is an ordinary button, tap included, when it is not busy', () => {
    const onClick = vi.fn()
    view.render(<Button icon="scanFace" onClick={onClick}>Try again</Button>)
    expect(button().hasAttribute('aria-busy')).toBe(false)
    expect(button().querySelector('.g-spin')).toBeNull()
    click(button())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('stays enabled while busy: a disabled one would go grey and drop focus', () => {
    view.render(<Button busy>Sign in</Button>)
    expect(button().disabled).toBe(false)
  })
})

describe('Button glass', () => {
  it('is a variant of its own', () => {
    view.render(<Button variant="glass">Use a code from your other device</Button>)
    expect(button().classList.contains('g-btn-glass')).toBe(true)
  })

  it('still refuses a variant the design system does not have, in development', () => {
    expect(() => view.render(<Button variant="frosted">x</Button>)).toThrow(/variant="frosted"/)
  })
})
