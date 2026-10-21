// @vitest-environment happy-dom
// ConfirmDrawer: the content of a drawer that asks first, where Undo cannot reverse the action.
// What goes, a quiet note, the danger button and the way back; every word is the caller's.
import { describe, expect, it, vi } from 'vitest'
import ConfirmDrawer from './ConfirmDrawer.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const buttons = () => [...view.host.querySelectorAll('.g-btn')]

describe('ConfirmDrawer', () => {
  it('shows the body, what goes, the note, then the danger button and the way back, in that order', () => {
    view.render(<ConfirmDrawer body="Push A closes and these go:" items={['14 logged sets, warm-up included', '24:18 on the clock']}
      note="You can still undo for 8 s on Today." confirmLabel="Discard workout" cancelLabel="Keep going" />)
    const root = view.host.firstElementChild
    expect(root.classList.contains('g-confirm')).toBe(true)
    expect([...root.children].map(c => c.tagName)).toEqual(['P', 'UL', 'P', 'BUTTON', 'BUTTON'])
    expect(root.querySelector('p').textContent).toBe('Push A closes and these go:')
    expect([...root.querySelectorAll('li')].map(li => li.textContent)).toEqual(['14 logged sets, warm-up included', '24:18 on the clock'])
    expect(root.querySelector('.g-confirm-note').textContent).toBe('You can still undo for 8 s on Today.')
    expect(buttons().map(b => b.textContent)).toEqual(['Discard workout', 'Keep going'])
  })

  it('the confirm button is the danger one and the cancel is the plain one', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard workout" cancelLabel="Keep going" />)
    expect(buttons()[0].classList.contains('g-confirm-danger')).toBe(true)
    expect(buttons()[1].classList.contains('g-btn-secondary')).toBe(true)
    expect(buttons()[1].classList.contains('g-btn-block')).toBe(true)
  })

  it('calls onConfirm and onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    view.render(<ConfirmDrawer confirmLabel="Discard" onConfirm={onConfirm} cancelLabel="Keep going" onCancel={onCancel} />)
    click(buttons()[0])
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
    click(buttons()[1])
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('is a link for each button that has an href', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard" confirmHref="#/discard" cancelLabel="Keep going" cancelHref="#/back" />)
    expect(buttons().map(b => b.tagName)).toEqual(['A', 'A'])
    expect(buttons().map(b => b.getAttribute('href'))).toEqual(['#/discard', '#/back'])
  })

  it('draws a warning triangle on the danger button unless told another icon, and leaves out what it has no words for', () => {
    view.render(<ConfirmDrawer confirmLabel="Discard" cancelLabel="Keep going" />)
    expect(buttons()[0].querySelector('svg').getAttribute('data-icon')).toBe('warning')
    expect(view.host.querySelector('ul')).toBeNull()
    expect(view.host.querySelector('p')).toBeNull()
    view.render(<ConfirmDrawer confirmLabel="Delete" icon="xmark" cancelLabel="Cancel" />)
    expect(buttons()[0].querySelector('svg').getAttribute('data-icon')).toBe('xmark')
  })
})
