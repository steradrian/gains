// @vitest-environment happy-dom
// StageSection: the title, and a right-hand value that is a link or button only when it goes
// somewhere.
import { describe, expect, it, vi } from 'vitest'
import StageSection from './StageSection.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const act = () => view.host.querySelector('.g-ssec-act')

describe('StageSection', () => {
  it('is a heading with a link on the right when it has an href', () => {
    view.render(<StageSection title="Food" action="See day" actionHref="#/eat" />)
    expect(view.host.querySelector('h2').textContent).toBe('Food')
    expect(act().tagName).toBe('A')
    expect(act().getAttribute('href')).toBe('#/eat')
  })

  it('is a button with a callback', () => {
    const onAction = vi.fn()
    view.render(<StageSection title="Food" action="See day" onAction={onAction} />)
    expect(act().tagName).toBe('BUTTON')
    click(act())
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('says a value without making it tappable', () => {
    view.render(<StageSection title="Water" action="1.25 of 2.5 L" />)
    expect(act().tagName).toBe('SPAN')
    expect(act().textContent).toBe('1.25 of 2.5 L')
    expect(view.host.querySelector('button, a')).toBeNull()
  })

  it('is the title alone with no action', () => {
    view.render(<StageSection title="Up next" />)
    expect(act()).toBeNull()
  })
})
