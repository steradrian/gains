// @vitest-environment happy-dom
// Chip: the stage filter chip. A toggle (aria-pressed) unless it opens a choice (a ▾ and
// aria-haspopup); an optional count after the label.
import { describe, expect, it, vi } from 'vitest'
import Chip from './Chip.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const chip = () => view.host.querySelector('button')

describe('Chip', () => {
  it('is a toggle: aria-pressed follows pressed, and lit when pressed', () => {
    view.render(<Chip>Favourites</Chip>)
    expect(chip().getAttribute('aria-pressed')).toBe('false')
    expect(chip().classList.contains('on')).toBe(false)
    view.render(<Chip pressed>Favourites</Chip>)
    expect(chip().getAttribute('aria-pressed')).toBe('true')
    expect(chip().classList.contains('on')).toBe(true)
    expect(chip().classList.contains('g-fchip-stage')).toBe(true)
  })

  it('tells onClick', () => {
    const onClick = vi.fn()
    view.render(<Chip onClick={onClick}>Favourites</Chip>)
    click(chip())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows the count after the label, as part of what is read', () => {
    view.render(<Chip count={3}>Favourites</Chip>)
    expect(chip().textContent).toBe('Favourites · 3')
    view.render(<Chip count={0}>Favourites</Chip>)
    expect(chip().textContent).toBe('Favourites · 0')
    view.render(<Chip>Favourites</Chip>)
    expect(chip().textContent).toBe('Favourites')
  })

  it('one that opens a choice has the ▾ and a popup, and is not a toggle', () => {
    view.render(<Chip opens pressed>Barbell</Chip>)
    expect(chip().querySelector('.g-fchip-caret')).not.toBeNull()
    expect(chip().getAttribute('aria-haspopup')).toBe('dialog')
    expect(chip().hasAttribute('aria-pressed')).toBe(false)
    expect(chip().classList.contains('on')).toBe(true)
  })

  it('has no ▾ and no popup when it does not open anything', () => {
    view.render(<Chip>Favourites</Chip>)
    expect(chip().querySelector('.g-fchip-caret')).toBeNull()
    expect(chip().hasAttribute('aria-haspopup')).toBe(false)
  })

  it('refuses a tone the kit does not have, in development', () => {
    expect(() => view.render(<Chip tone="light">x</Chip>)).toThrow(/tone="light"/)
  })
})
