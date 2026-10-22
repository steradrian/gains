// @vitest-environment happy-dom
// StageSlider: a native range under Quiet and Bold. It previews on every step and writes once, on release.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import StageSlider from './StageSlider.jsx'
import { type, useView } from './render.test-util.js'

const view = useView()
const input = () => view.host.querySelector('input[type="range"]')
const release = () => act(() => { input().dispatchEvent(new Event('pointerup', { bubbles: true })) })

describe('StageSlider', () => {
  it('shows the ends, the value as a percentage, and a labelled range from 0 to 100', () => {
    view.render(<StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={0.45} />)
    expect(view.host.textContent).toContain('Quiet')
    expect(view.host.textContent).toContain('Bold')
    expect(view.host.textContent).toContain('45%')
    expect(input().getAttribute('aria-label')).toBe('Intensity')
    expect(input().value).toBe('45')
    expect(input().min).toBe('0')
    expect(input().max).toBe('100')
  })

  it('previews each step with onChange as a number from 0 to 1, and writes nothing until release', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()
    view.render(<StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={0.45} onChange={onChange} onCommit={onCommit} />)
    type(input(), '70')
    expect(onChange).toHaveBeenCalledWith(0.7)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('commits the value on release', () => {
    const onCommit = vi.fn()
    view.render(<StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={0.3} onCommit={onCommit} haptic={false} />)
    release()
    expect(onCommit).toHaveBeenCalledWith(0.3)
  })

  it('clamps a value outside 0 to 1', () => {
    view.render(<StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={1.7} />)
    expect(input().value).toBe('100')
    view.render(<StageSlider label="Intensity" minLabel="Quiet" maxLabel="Bold" value={-1} />)
    expect(input().value).toBe('0')
  })
})
