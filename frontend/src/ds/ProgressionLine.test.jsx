// @vitest-environment happy-dom
// ProgressionLine and NotCountedLine (boards W1.0, W1.47, W1.50, W1.51): the progression line is one
// button with the policy in bold and the reason after it; the not-counted line is a dashed line
// with Undo.
import { describe, expect, it, vi } from 'vitest'
import NotCountedLine from './NotCountedLine.jsx'
import ProgressionLine from './ProgressionLine.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()

describe('ProgressionLine', () => {
  it('is one button: an icon, the policy in bold, " · " and the reason, named by the caller\'s sentence', () => {
    const onClick = vi.fn()
    view.render(<ProgressionLine icon="arrowUp" policy="Double progression" reason="Hit 12 reps." label="Double progression. Hit 12 reps. Open exercise settings" onClick={onClick} />)
    const line = view.host.querySelector('button.g-prog')
    expect(line.getAttribute('aria-label')).toBe('Double progression. Hit 12 reps. Open exercise settings')
    expect(line.querySelector('b').textContent).toBe('Double progression')
    expect(line.querySelector('.g-prog-text').textContent).toBe('Double progression · Hit 12 reps.')
    expect(line.querySelector('svg').getAttribute('data-icon')).toBe('arrowUp')
    click(line)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('reads a deload in the warning tone', () => {
    view.render(<ProgressionLine icon="arrowDown" tone="warning" policy="Linear" reason="Back off." label="x" onClick={() => {}} />)
    expect(view.host.querySelector('.g-prog').className).toContain('g-prog-warning')
  })

  it('draws nothing without a policy and a reason', () => {
    view.render(<ProgressionLine policy="Linear" label="x" />)
    expect(view.host.querySelector('.g-prog')).toBeNull()
  })
})

describe('NotCountedLine', () => {
  it('says it and offers Undo, named by the caller', () => {
    const onUndo = vi.fn()
    view.render(<NotCountedLine text="Not counted for progression today" undoText="Undo" undoLabel="Count Cable fly again" onUndo={onUndo} />)
    expect(view.host.querySelector('.g-nc-text').textContent).toBe('Not counted for progression today')
    const undo = view.host.querySelector('button.g-nc-undo')
    expect(undo.getAttribute('aria-label')).toBe('Count Cable fly again')
    click(undo)
    expect(onUndo).toHaveBeenCalledOnce()
  })

  it('has no button when there is nothing to undo, and draws nothing without text', () => {
    view.render(<NotCountedLine text="Not counted for progression" />)
    expect(view.host.querySelector('.g-nc-undo')).toBeNull()
    view.render(<NotCountedLine />)
    expect(view.host.querySelector('.g-nc')).toBeNull()
  })
})
