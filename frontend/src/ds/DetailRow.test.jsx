// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import DetailRow from './DetailRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.firstElementChild

describe('DetailRow', () => {
  it('a row that goes nowhere is a plain div: icon, two lines and a value, no chevron', () => {
    view.render(<DetailRow icon="dumbbell" title="Plate loading" sub="Olympic bar, 20 kg" value="20 kg" />)
    expect(row().tagName).toBe('DIV')
    expect(row().className).toBe('g-drow')
    expect(row().querySelector('.g-drow-ic').className).toBe('g-drow-ic')
    expect(row().querySelector('.g-drow-body b').textContent).toBe('Plate loading')
    expect(row().querySelector('.g-drow-body span').textContent).toBe('Olympic bar, 20 kg')
    expect(row().querySelector('.g-drow-val').textContent).toBe('20 kg')
    expect(row().querySelector('.g-drow-chev')).toBeNull()
  })

  it('with onClick it is a button with a chevron, named by its text alone', () => {
    const onClick = vi.fn()
    view.render(<DetailRow icon="plus" tint title="Add to my plan" sub="Pick a routine. Sets, reps and weight come next." onClick={onClick} />)
    expect(row().tagName).toBe('BUTTON')
    expect(row().getAttribute('aria-label')).toBeNull()
    expect(row().querySelector('.g-drow-ic-tint')).not.toBeNull()
    expect(row().querySelector('.g-drow-chev')).not.toBeNull()
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('with href it is a link; chevron={false} hides the chevron', () => {
    view.render(<DetailRow title="Suggest a fix" href="#/x" chevron={false} />)
    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('#/x')
    expect(row().querySelector('.g-drow-chev')).toBeNull()
  })

  it('a trailing control takes the chevron\'s place; danger reddens the title', () => {
    view.render(<DetailRow title="Delete exercise" danger onClick={() => {}} trailing={<span className="t">x</span>} />)
    expect(row().querySelector('.t')).not.toBeNull()
    expect(row().querySelector('.g-drow-chev')).toBeNull()
    expect(row().querySelector('b').className).toBe('g-danger')
  })
})
