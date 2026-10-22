// @vitest-environment happy-dom
// CheerList and CheerRow: a list of plain rows in one glass card (not buttons), each with the
// sender's initial in their colour, the line, an optional detail and when; the list is named for
// a screen reader by the caller.
import { describe, expect, it } from 'vitest'
import { useView } from './render.test-util.js'
import CheerList from './CheerList.jsx'

const view = useView()
const ROWS = [
  { key: 'a', initial: 'Mara', tone: 'sky', text: 'Mara cheered your Push A', detail: 'Sunday evening', when: '2 h ago' },
  { key: 'b', initial: 'Radu', tone: 'iris', text: 'Radu cheered your week', when: 'Yesterday' },
]

describe('CheerList', () => {
  it('is a named list of rows in the glass card', () => {
    view.render(<CheerList label="Cheers this week" rows={ROWS} />)
    const list = view.host.querySelector('ul')
    expect(list.getAttribute('aria-label')).toBe('Cheers this week')
    expect(list.classList.contains('g-glass')).toBe(true)
    expect(list.querySelectorAll('li.g-crow')).toHaveLength(2)
  })

  it('draws the initial in the person\'s colour, the line, the detail and when', () => {
    view.render(<CheerList label="x" rows={ROWS} />)
    const [first] = view.host.querySelectorAll('.g-crow')
    expect(first.querySelector('.g-mavatar').textContent).toBe('M')
    expect(first.querySelector('.g-mavatar').classList.contains('g-mtone-sky')).toBe(true)
    expect(first.querySelector('b').textContent).toBe('Mara cheered your Push A')
    expect(first.querySelector('.g-crow-body > span').textContent).toBe('Sunday evening')
    expect(first.querySelector('small').textContent).toBe('2 h ago')
  })

  it('leaves out a detail it does not have, and is no button or link', () => {
    view.render(<CheerList label="x" rows={ROWS} />)
    const second = view.host.querySelectorAll('.g-crow')[1]
    expect(second.querySelector('.g-crow-body > span')).toBeNull()
    expect(view.host.querySelector('button, a')).toBeNull()
  })
})
