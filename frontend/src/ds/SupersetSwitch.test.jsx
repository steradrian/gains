// @vitest-environment happy-dom
// SupersetSwitch (boards W1.24, W1.38): A1 / A2 tabs and the note, on the stage.
import { describe, expect, it, vi } from 'vitest'
import SupersetSwitch from './SupersetSwitch.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const tabs = () => [...view.host.querySelectorAll('.g-ssw-s')]

describe('SupersetSwitch', () => {
  it('draws the two tags and names, the note and the group\'s name from the caller', () => {
    view.render(<SupersetSwitch a="Lateral raise" b="Pushdown" note="Superset · go straight to A2, rest 1:00 after both" ariaLabel="Superset" />)
    expect(tabs().map(t => t.textContent)).toEqual(['A1 Lateral raise', 'A2 Pushdown'])
    expect(view.host.querySelector('.g-ssw-note').textContent).toBe('Superset · go straight to A2, rest 1:00 after both')
    expect(view.host.querySelector('[role="group"]').getAttribute('aria-label')).toBe('Superset')
  })

  it('takes the tags from the caller', () => {
    view.render(<SupersetSwitch a="Écarté" b="Triceps" tags={['B1', 'B2']} ariaLabel="x" />)
    expect(tabs().map(t => t.textContent)).toEqual(['B1 Écarté', 'B2 Triceps'])
  })

  it('has no note line without a note', () => {
    view.render(<SupersetSwitch a="a" b="b" ariaLabel="x" />)
    expect(view.host.querySelector('.g-ssw-note')).toBeNull()
  })

  it('keeps its own choice when not controlled, and says it with aria-pressed', () => {
    const onChange = vi.fn()
    view.render(<SupersetSwitch a="a" b="b" ariaLabel="x" onChange={onChange} />)
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
    click(tabs()[1])
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    expect(tabs()[1].classList.contains('on')).toBe(true)
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('shows what it is given when controlled, and only asks', () => {
    const onChange = vi.fn()
    view.render(<SupersetSwitch a="a" b="b" ariaLabel="x" active="b" onChange={onChange} />)
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
    click(tabs()[0])
    expect(onChange).toHaveBeenCalledWith('a')
    expect(tabs().map(t => t.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  })
})
