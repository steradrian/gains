// @vitest-environment happy-dom
// SupersetGroup: a superset's exercises under one header line, which is a button only with onClick.
import { describe, expect, it, vi } from 'vitest'
import SupersetGroup from './SupersetGroup.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const head = () => view.host.querySelector('.g-ssg-h')

describe('SupersetGroup', () => {
  it('holds its rows under the header line, which is said, not pressed, without onClick', () => {
    view.render(<SupersetGroup title="Superset" detail="1:30 rest after both"><i>a</i><i>b</i></SupersetGroup>)
    expect(head().tagName).toBe('DIV')
    expect(head().textContent).toBe('Superset· 1:30 rest after both')
    expect(view.host.querySelectorAll('.g-ssg-rows i')).toHaveLength(2)
  })

  it('with onClick the header is a button, named by label when given', () => {
    const onClick = vi.fn()
    view.render(<SupersetGroup title="Chest pair" onClick={onClick} label="Name and rest of this superset"><i>a</i></SupersetGroup>)
    expect(head().tagName).toBe('BUTTON')
    expect(head().getAttribute('aria-label')).toBe('Name and rest of this superset')
    click(head())
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('puts the caller\'s class and style on the group a reorder moves', () => {
    view.render(<SupersetGroup title="Superset" className="is-dragging" style={{ transform: 'translate3d(0, 12px, 0)' }}><i>a</i></SupersetGroup>)
    const group = view.host.querySelector('.g-ssg')
    expect(group.classList.contains('is-dragging')).toBe(true)
    expect(group.style.transform).toBe('translate3d(0, 12px, 0)')
  })
})
