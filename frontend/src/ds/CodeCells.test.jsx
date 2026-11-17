// @vitest-environment happy-dom
// CodeCells: one real input under the cells takes whatever arrives (typing, a paste, the device's
// one-time-code autofill) and keeps only an uppercase code of the right length.
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import CodeCells from './CodeCells.jsx'
import { type, useView } from './render.test-util.js'

const view = useView()
const input = () => view.host.querySelector('input')
const cells = () => [...view.host.querySelectorAll('.g-code-cell')].map(c => c.textContent)

function Controlled({ onChange, ...props }) {
  const [code, setCode] = useState('')
  return <CodeCells {...props} value={code} onChange={v => { setCode(v); onChange(v) }} />
}

describe('CodeCells', () => {
  it('uppercases what is typed and drops anything but letters and digits', () => {
    const onChange = vi.fn()
    view.render(<Controlled onChange={onChange} />)
    type(input(), 'a7-k 2!')
    expect(onChange).toHaveBeenLastCalledWith('A7K2')
    expect(input().value).toBe('A7K2')
    expect(cells()).toEqual(['A', '7', 'K', '2', '', ''])
  })

  it('keeps no more than its length, a pasted longer code included', () => {
    const onChange = vi.fn()
    view.render(<Controlled length={4} onChange={onChange} />)
    type(input(), 'abcdefgh')
    expect(onChange).toHaveBeenLastCalledWith('ABCD')
    expect(cells()).toEqual(['A', 'B', 'C', 'D'])
  })

  it('takes a code pasted with its dashes whole: the input never cuts it before they are dropped', () => {
    const onChange = vi.fn()
    view.render(<Controlled length={12} onChange={onChange} />)
    expect(input().hasAttribute('maxlength')).toBe(false)
    type(input(), 'k7wq-2mzp-4hxa')
    expect(onChange).toHaveBeenLastCalledWith('K7WQ2MZP4HXA')
    expect(cells()).toHaveLength(12)
    expect(cells().join('')).toBe('K7WQ2MZP4HXA')
  })

  it('keeps its own value when nobody controls it', () => {
    view.render(<CodeCells />)
    type(input(), 'xy9')
    expect(cells()).toEqual(['X', 'Y', '9', '', '', ''])
  })

  it('is the one-time-code field the device autofills, named Code unless told otherwise', () => {
    view.render(<CodeCells numeric />)
    expect(input().getAttribute('autocomplete')).toBe('one-time-code')
    expect(input().getAttribute('inputmode')).toBe('numeric')
    expect(input().getAttribute('aria-label')).toBe('Code')
    view.render(<CodeCells label="Reset code" />)
    expect(input().getAttribute('inputmode')).toBe('text')
    expect(input().getAttribute('aria-label')).toBe('Reset code')
  })

  it('says it is invalid, and marks every cell instead of the next one', () => {
    view.render(<CodeCells value="AB" />)
    expect(input().hasAttribute('aria-invalid')).toBe(false)
    expect(view.host.querySelectorAll('.g-code-cell.cur')).toHaveLength(1)
    view.render(<CodeCells value="AB" invalid />)
    expect(input().getAttribute('aria-invalid')).toBe('true')
    expect(view.host.querySelectorAll('.g-code-cell.bad')).toHaveLength(6)
    expect(view.host.querySelectorAll('.g-code-cell.cur')).toHaveLength(0)
  })

  it('draws every cell as flat glass: the fill stays, no lens', () => {
    view.render(<CodeCells value="AB" />)
    expect([...view.host.querySelectorAll('.g-code-cell')].every(c => c.dataset.glass === 'flat')).toBe(true)
  })

  it('keeps the cells out of the accessibility tree: the input is what is read', () => {
    view.render(<CodeCells value="AB" />)
    expect([...view.host.querySelectorAll('.g-code-cell')].every(c => c.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
