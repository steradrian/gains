// @vitest-environment happy-dom
// StageChoiceCard: one answer, chosen with one tap; it says which answer is chosen, and goes
// somewhere instead when it is a link.
import { describe, expect, it, vi } from 'vitest'
import StageChoiceCard from './StageChoiceCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const card = () => view.host.firstElementChild
const ticked = () => !!card().querySelector('.g-ccard-mark svg')

describe('StageChoiceCard', () => {
  it('is a button that answers a tap', () => {
    const onClick = vi.fn()
    view.render(<StageChoiceCard title="Build muscle" sub="A small surplus" onClick={onClick} />)
    expect(card().tagName).toBe('BUTTON')
    expect(card().getAttribute('type')).toBe('button')
    expect(card().textContent).toBe('Build muscle' + 'A small surplus')
    click(card())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('says whether it is the chosen answer, and ticks it', () => {
    view.render(<StageChoiceCard title="Male" onClick={() => {}} />)
    expect(card().getAttribute('aria-pressed')).toBe('false')
    expect(ticked()).toBe(false)
    view.render(<StageChoiceCard title="Male" selected onClick={() => {}} />)
    expect(card().getAttribute('aria-pressed')).toBe('true')
    expect(ticked()).toBe(true)
  })

  it('is a link with an href, with no pressed state of its own', () => {
    view.render(<StageChoiceCard title="Rather not say" href="#/next" selected />)
    expect(card().tagName).toBe('A')
    expect(card().getAttribute('href')).toBe('#/next')
    expect(card().hasAttribute('aria-pressed')).toBe(false)
  })

  it('leads with its icon when it has one', () => {
    view.render(<StageChoiceCard title="Lose weight" icon="scale" />)
    expect(card().querySelector('.g-ccard-ic [data-icon="scale"]')).not.toBeNull()
    view.render(<StageChoiceCard title="Lose weight" />)
    expect(card().querySelector('.g-ccard-ic')).toBeNull()
  })
})
