// @vitest-environment happy-dom
// TextField: the label is the field's name (never a placeholder in its place), the unit is part of
// it, the hint describes it, and each field's ids are its own.
import { describe, expect, it, vi } from 'vitest'
import TextField from './TextField.jsx'
import { type, useView } from './render.test-util.js'

const view = useView()
const inputs = () => [...view.host.querySelectorAll('input')]
const textOf = ids => ids.split(' ').map(id => document.getElementById(id).textContent).join(' ')

describe('TextField', () => {
  it('is named by its label, and its label focuses it', () => {
    view.render(<TextField label="Your name" placeholder="First name" />)
    const [input] = inputs()
    expect(textOf(input.getAttribute('aria-labelledby'))).toBe('Your name')
    expect(view.host.querySelector('label').htmlFor).toBe(input.id)
  })

  it('is named with its unit and described by its hint', () => {
    view.render(<TextField label="Target weight" unit="kg" hint="You can change it later" tone="stage" />)
    const [input] = inputs()
    expect(textOf(input.getAttribute('aria-labelledby'))).toBe('Target weight kg')
    expect(textOf(input.getAttribute('aria-describedby'))).toBe('You can change it later')
  })

  it('gives each field ids of its own', () => {
    view.render(<><TextField label="Protein" unit="g" /><TextField label="Carbs" unit="g" /></>)
    const [a, b] = inputs()
    expect(a.id).not.toBe(b.id)
    expect(textOf(a.getAttribute('aria-labelledby'))).toBe('Protein g')
    expect(textOf(b.getAttribute('aria-labelledby'))).toBe('Carbs g')
  })

  it('starts from its value and reports each change', () => {
    const onChange = vi.fn()
    view.render(<TextField label="Serving" value={150} onChange={onChange} />)
    const [input] = inputs()
    expect(input.value).toBe('150')
    type(input, '175')
    expect(onChange).toHaveBeenLastCalledWith('175')
  })
})
