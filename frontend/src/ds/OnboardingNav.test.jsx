// @vitest-environment happy-dom
// OnboardingNav: where you are in the steps (a progressbar a screen reader can read), and Back and
// Skip as buttons or as links, or holding their place when the step has neither.
import { describe, expect, it, vi } from 'vitest'
import OnboardingNav from './OnboardingNav.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const bar = () => view.host.querySelector('[role="progressbar"]')
const back = () => view.host.querySelector('[aria-label="Back"]')
const skip = () => [...view.host.querySelectorAll('a, button')].find(e => e !== back())

describe('OnboardingNav', () => {
  it('reads as step n of the total, eight unless told', () => {
    view.render(<OnboardingNav step={3} />)
    expect(bar().getAttribute('aria-valuemin')).toBe('1')
    expect(bar().getAttribute('aria-valuemax')).toBe('8')
    expect(bar().getAttribute('aria-valuenow')).toBe('3')
    expect(bar().getAttribute('aria-label')).toBe('Step 3 of 8')
    view.render(<OnboardingNav step={2} total={4} />)
    expect(bar().getAttribute('aria-label')).toBe('Step 2 of 4')
  })

  it('fills the segments up to and including the step', () => {
    view.render(<OnboardingNav step={3} total={5} />)
    expect([...bar().children].map(s => s.classList.contains('on'))).toEqual([true, true, true, false, false])
  })

  it('lights up to `filled` when that is further, and still reads as the step on screen', () => {
    view.render(<OnboardingNav step={2} filled={4} total={5} />)
    expect([...bar().children].map(s => s.classList.contains('on'))).toEqual([true, true, true, true, false])
    expect(bar().getAttribute('aria-valuenow')).toBe('2')
    view.render(<OnboardingNav step={3} filled={1} total={5} />)
    expect([...bar().children].filter(s => s.classList.contains('on'))).toHaveLength(3)
  })

  it('has no progressbar without a step', () => {
    view.render(<OnboardingNav onBack={() => {}} />)
    expect(bar()).toBeNull()
  })

  it('calls back and skip as buttons', () => {
    const onBack = vi.fn(), onSkip = vi.fn()
    view.render(<OnboardingNav step={1} onBack={onBack} onSkip={onSkip} />)
    expect(back().tagName).toBe('BUTTON')
    expect(skip().tagName).toBe('BUTTON')
    expect(skip().textContent).toBe('Skip')
    click(back())
    click(skip())
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('links back and skip with an href, and takes its own skip label', () => {
    view.render(<OnboardingNav step={1} backHref="#/welcome" skipHref="#/next" skipLabel="Not now" />)
    expect(back().tagName).toBe('A')
    expect(back().getAttribute('href')).toBe('#/welcome')
    expect(skip().tagName).toBe('A')
    expect(skip().getAttribute('href')).toBe('#/next')
    expect(skip().textContent).toBe('Not now')
  })

  it('offers neither when the step has neither', () => {
    view.render(<OnboardingNav step={4} />)
    expect(view.host.querySelectorAll('a, button')).toHaveLength(0)
  })
})
