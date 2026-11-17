// @vitest-environment happy-dom
// PlateLine (board W1.2): "Bar 20 kg + 25 + 5 each side", one glass row that opens the plates.
import { describe, expect, it, vi } from 'vitest'
import PlateLine from './PlateLine.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('PlateLine', () => {
  it('says the caller\'s text, is named by the caller\'s label and opens on a press', () => {
    const onClick = vi.fn()
    view.render(<PlateLine text="Barre 20 kg + 25 + 5 de chaque côté" label="Chargement des disques" onClick={onClick} />)
    const row = view.host.querySelector('.g-plline')
    expect(row.tagName).toBe('BUTTON')
    expect(row.textContent).toBe('Barre 20 kg + 25 + 5 de chaque côté')
    expect(row.getAttribute('aria-label')).toBe('Chargement des disques')
    expect(row.classList.contains('g-glass')).toBe(true)
    click(row)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a link with an href', () => {
    view.render(<PlateLine text="Bar 20 kg" label="Plate loading" href="#/plates" />)
    expect(view.host.querySelector('.g-plline').tagName).toBe('A')
  })

  it('draws nothing without a text', () => {
    view.render(<PlateLine label="Plate loading" onClick={() => {}} />)
    expect(view.host.querySelector('.g-plline')).toBeNull()
    view.render(<PlateLine text="" label="Plate loading" />)
    expect(view.host.querySelector('.g-plline')).toBeNull()
  })
})
