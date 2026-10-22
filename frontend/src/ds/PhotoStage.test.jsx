// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import PhotoStage from './PhotoStage.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('PhotoStage', () => {
  it('is a named modal dialog with the title, a polite count, the content and the action bar', () => {
    view.render(
      <PhotoStage label="Photo" title="Sun 18 Oct 2026" count="2 of 6" closeLabel="Close" onClose={() => {}} actions={<button type="button">Delete</button>}>
        <p>the photo</p>
      </PhotoStage>,
    )
    const dialog = view.host.querySelector('[role="dialog"]')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-label')).toBe('Photo')
    expect(dialog.querySelector('h2').textContent).toBe('Sun 18 Oct 2026')
    expect(dialog.querySelector('[aria-live="polite"]').textContent).toBe('2 of 6')
    expect(dialog.querySelector('.g-pstage-body p').textContent).toBe('the photo')
    expect(dialog.querySelector('.g-pstage-acts button').textContent).toBe('Delete')
  })

  it('closes from the labelled close button, and leaves out the action bar without actions', () => {
    const onClose = vi.fn()
    view.render(<PhotoStage label="Photo" title="t" closeLabel="Close" onClose={onClose}>x</PhotoStage>)
    click(view.host.querySelector('button[aria-label="Close"]'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(view.host.querySelector('.g-pstage-acts')).toBeNull()
  })

  it('passes keyboard props to the dialog', () => {
    const onKeyDown = vi.fn()
    view.render(<PhotoStage label="Photo" title="t" closeLabel="Close" onClose={() => {}} tabIndex={-1} onKeyDown={onKeyDown}>x</PhotoStage>)
    const dialog = view.host.querySelector('[role="dialog"]')
    expect(dialog.getAttribute('tabindex')).toBe('-1')
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onKeyDown).toHaveBeenCalledTimes(1)
  })
})
