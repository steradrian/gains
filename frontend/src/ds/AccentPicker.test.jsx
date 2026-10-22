// @vitest-environment happy-dom
// AccentPicker: the 28 themes as a radio group. The lit one is the only tab stop, a tap or an arrow
// key picks, and the swatch is filled from the theme's own tokens.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { THEMES } from '../lib/themes.js'
import AccentPicker from './AccentPicker.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const radios = () => [...view.host.querySelectorAll('[role="radio"]')]
const press = (el, key) => act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })) })

describe('AccentPicker', () => {
  it('is a labelled radio group of the 28 themes, named, with the value lit', () => {
    view.render(<AccentPicker value="moss" onChange={() => {}} label="Accent color" />)
    const group = view.host.querySelector('[role="radiogroup"]')
    expect(group.getAttribute('aria-label')).toBe('Accent color')
    expect(radios()).toHaveLength(28)
    expect(radios().map(r => r.textContent)).toEqual(THEMES.map(p => p.name))
    expect(radios().filter(r => r.getAttribute('aria-checked') === 'true').map(r => r.textContent)).toEqual(['Moss'])
    expect(radios().filter(r => r.tabIndex === 0).map(r => r.textContent)).toEqual(['Moss'])
  })

  it('draws the check on the lit swatch only, in the theme\'s gradient', () => {
    view.render(<AccentPicker value="plum" onChange={() => {}} label="Accent" />)
    expect(view.host.querySelectorAll('.g-apick-sw .g-icon')).toHaveLength(1)
    const sw = radios().find(r => r.textContent === 'Plum').querySelector('.g-apick-sw')
    expect(sw.querySelector('.g-icon')).not.toBeNull()
    expect(sw.getAttribute('style')).toContain('var(--plum-fill)')
    expect(sw.getAttribute('style')).toContain('var(--plum-fill-end)')
  })

  it('a tap writes the id', () => {
    const onChange = vi.fn()
    view.render(<AccentPicker value="cobalt" onChange={onChange} label="Accent" />)
    click(radios().find(r => r.textContent === 'Jade'))
    expect(onChange).toHaveBeenCalledWith('jade')
  })

  it('the arrow keys move the choice and the focus, wrapping at the ends', () => {
    const onChange = vi.fn()
    view.render(<AccentPicker value={THEMES[0].id} onChange={onChange} label="Accent" />)
    radios()[0].focus()
    press(radios()[0], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith(THEMES[1].id)
    expect(document.activeElement).toBe(radios()[1])
    radios()[0].focus()
    press(radios()[0], 'ArrowLeft')
    expect(onChange).toHaveBeenLastCalledWith(THEMES.at(-1).id)
  })

  it('with a value that is no theme, the first is the tab stop', () => {
    view.render(<AccentPicker value={null} onChange={() => {}} label="Accent" />)
    expect(radios().filter(r => r.tabIndex === 0)).toEqual([radios()[0]])
    expect(radios().some(r => r.getAttribute('aria-checked') === 'true')).toBe(false)
  })
})
