// @vitest-environment happy-dom
// SearchFeatureCard: a match in a switched-off feature, with Turn on and the page of its switch.
import { describe, expect, it, vi } from 'vitest'
import SearchFeatureCard from './SearchFeatureCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = s => view.host.querySelector(s)
const LINE = 'A timer for your fasts with a goal and history. It is off in Features, so Eat doesn’t show it.'

describe('SearchFeatureCard', () => {
  it('names the feature, says it is Off and what it does', () => {
    view.render(<SearchFeatureCard title="Fasting" ranges={[[0, 4]]} line={LINE} icon="timer" pageTitle="Features" />)
    expect(q('.g-sfeat-name b .sr-only').textContent).toBe('Fasting')
    expect(q('.g-hl').textContent).toBe('Fast')
    expect(q('.g-sfeat-off').textContent).toBe('Off')
    expect(q('.g-sfeat-line').textContent).toBe(LINE)
  })

  it('reads the highlighted name as one word: the pieces are hidden, the whole name is said once', () => {
    view.render(<SearchFeatureCard title="Fasting" ranges={[[0, 4]]} line={LINE} pageTitle="Features" />)
    expect(q('.g-hl').closest('[aria-hidden="true"]')).not.toBeNull()
    const spoken = [...q('.g-sfeat-name b').childNodes].filter(n => n.getAttribute?.('aria-hidden') !== 'true')
    expect(spoken.map(n => n.textContent)).toEqual(['Fasting'])
  })

  it('Turn on flips it, the page button opens its switch', () => {
    const onTurnOn = vi.fn(), onOpenPage = vi.fn()
    view.render(<SearchFeatureCard title="Fasting" line={LINE} pageTitle="Features" onTurnOn={onTurnOn} onOpenPage={onOpenPage} />)
    expect(q('.g-sfeat-on').textContent).toBe('Turn on Fasting')
    expect(q('.g-sfeat-page').textContent).toBe('Features')
    click(q('.g-sfeat-on'))
    click(q('.g-sfeat-page'))
    expect(onTurnOn).toHaveBeenCalledTimes(1)
    expect(onOpenPage).toHaveBeenCalledTimes(1)
  })

  it('holds Turn on while it is busy, keeping the focus on it: aria-disabled, not disabled, and a press does nothing', () => {
    const onTurnOn = vi.fn()
    view.render(<SearchFeatureCard title="Gym check-in" pageTitle="Appearance" onTurnOn={onTurnOn} />)
    q('.g-sfeat-on').focus()
    view.render(<SearchFeatureCard title="Gym check-in" pageTitle="Appearance" busy onTurnOn={onTurnOn} />)
    expect(q('.g-sfeat-on').disabled).toBe(false)
    expect(q('.g-sfeat-on').getAttribute('aria-disabled')).toBe('true')
    expect(q('.g-sfeat-on').getAttribute('aria-busy')).toBe('true')
    expect(document.activeElement).toBe(q('.g-sfeat-on'))
    click(q('.g-sfeat-on'))
    expect(onTurnOn).not.toHaveBeenCalled()
    expect(q('.g-sfeat-page').textContent).toBe('Appearance')
  })
})
