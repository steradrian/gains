// @vitest-environment happy-dom
// Switch: the light drawer's switch. A role="switch" button that says whether it is on, bare or as
// a row with its title and line; controlled with onChange, else it keeps its own state.
import { describe, expect, it, vi } from 'vitest'
import Switch from './Switch.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const sw = () => view.host.querySelector('[role="switch"]')

describe('Switch', () => {
  it('is a switch button named by ariaLabel, off unless checked', () => {
    view.render(<Switch ariaLabel="Sound" />)
    expect(sw().tagName).toBe('BUTTON')
    expect(sw().getAttribute('type')).toBe('button')
    expect(sw().getAttribute('aria-label')).toBe('Sound')
    expect(sw().getAttribute('aria-checked')).toBe('false')
    view.render(<Switch ariaLabel="Sound" checked onChange={() => {}} />)
    expect(sw().getAttribute('aria-checked')).toBe('true')
  })

  it('keeps its own state when uncontrolled, and tells onChange the new one', () => {
    const onChange = vi.fn()
    view.render(<Switch ariaLabel="Sound" onChange={undefined} />)
    click(sw())
    expect(sw().getAttribute('aria-checked')).toBe('true')
    click(sw())
    expect(sw().getAttribute('aria-checked')).toBe('false')
    view.render(<Switch ariaLabel="Plates" checked onChange={onChange} />)
    click(sw())
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('is controlled with onChange: only the parent moves it', () => {
    const onChange = vi.fn()
    view.render(<Switch ariaLabel="Sound" checked={false} onChange={onChange} />)
    click(sw())
    expect(onChange).toHaveBeenCalledWith(true)
    expect(sw().getAttribute('aria-checked')).toBe('false')
  })

  it('with a label it is the whole row: the title names the switch and the line describes it', () => {
    view.render(<Switch label="Plate loading" description="Shows the plates under barbell sets" ariaLabel="ignored" />)
    expect(view.host.querySelector('.g-switchrow')).not.toBeNull()
    expect(view.host.querySelector('.g-switch-title').textContent).toBe('Plate loading')
    expect(view.host.querySelector('.g-switch-sub').textContent).toBe('Shows the plates under barbell sets')
    expect(document.getElementById(sw().getAttribute('aria-labelledby')).textContent).toBe('Plate loading')
    expect(document.getElementById(sw().getAttribute('aria-describedby')).textContent).toBe('Shows the plates under barbell sets')
    expect(sw().hasAttribute('aria-label')).toBe(false)
  })

  it('without a label there is no row, and without a description nothing describes it', () => {
    view.render(<Switch ariaLabel="Sound" />)
    expect(view.host.querySelector('.g-switchrow')).toBeNull()
    view.render(<Switch label="Sound" />)
    expect(sw().hasAttribute('aria-describedby')).toBe(false)
  })

  it('disabled ignores a tap', () => {
    const onChange = vi.fn()
    view.render(<Switch ariaLabel="Sound" disabled onChange={onChange} />)
    expect(sw().disabled).toBe(true)
    click(sw())
    expect(onChange).not.toHaveBeenCalled()
    expect(sw().getAttribute('aria-checked')).toBe('false')
  })
})
