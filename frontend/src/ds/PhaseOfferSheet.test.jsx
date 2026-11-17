// @vitest-environment happy-dom
// PhaseOfferSheet: the content of the warm-up and cool-down offers. The phase tag in its light
// tint, a line, the exercises it holds, then the start button and the skip button under it. Every
// word is the caller's.
import { describe, expect, it, vi } from 'vitest'
import PhaseOfferSheet from './PhaseOfferSheet.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const ITEMS = [{ name: 'Glute bridge', sub: '2 × 15' }, { name: 'Dead bug', sub: '2 × 10 each side' }, { name: 'Pec foam roll' }]
const tag = () => view.host.querySelector('.g-offer-tag')
const buttons = () => [...view.host.querySelectorAll('.g-btn')]

describe('PhaseOfferSheet', () => {
  it('shows the tag in the phase\'s tint, the line and the exercises with their lines', () => {
    view.render(<PhaseOfferSheet tone="warm" tag="Warm-up · 3" body="Logged like any exercise." items={ITEMS} startLabel="Start warm-up" skipLabel="Skip warm-up" />)
    expect(tag().textContent).toBe('Warm-up · 3')
    expect(tag().classList.contains('g-offer-warm')).toBe(true)
    expect(view.host.querySelector('p').textContent).toBe('Logged like any exercise.')
    const rows = [...view.host.querySelectorAll('.g-offer-row')]
    expect(rows.map(r => r.querySelector('b').textContent)).toEqual(['Glute bridge', 'Dead bug', 'Pec foam roll'])
    expect(rows.map(r => r.querySelector('small')?.textContent)).toEqual(['2 × 15', '2 × 10 each side', undefined])
  })

  it('is cool by default, and the tone picks the tint', () => {
    view.render(<PhaseOfferSheet tag="Cool-down · 3" startLabel="Start cool-down" skipLabel="Skip cool-down" />)
    expect(tag().classList.contains('g-offer-cool')).toBe(true)
    expect(tag().classList.contains('g-offer-warm')).toBe(false)
  })

  it('shows a still when an exercise has one, and a dumbbell tile when it has not', () => {
    view.render(<PhaseOfferSheet items={[{ name: 'Glute bridge', image: '/ex/bridge.png' }, { name: 'Dead bug' }]} startLabel="Start" skipLabel="Skip" />)
    const rows = [...view.host.querySelectorAll('.g-offer-row')]
    expect(rows[0].querySelector('img').getAttribute('src')).toBe('/ex/bridge.png')
    expect(rows[0].querySelector('img').getAttribute('alt')).toBe('')
    expect(rows[1].querySelector('img')).toBeNull()
    expect(rows[1].querySelector('.g-offer-ph svg')).not.toBeNull()
  })

  it('puts the start button first and the skip button under it, each with its handler', () => {
    const onStart = vi.fn()
    const onSkip = vi.fn()
    view.render(<PhaseOfferSheet items={ITEMS} startLabel="Start warm-up" onStart={onStart} skipLabel="Skip warm-up" onSkip={onSkip} />)
    expect(buttons().map(b => b.textContent)).toEqual(['Start warm-up', 'Skip warm-up'])
    expect(buttons()[0].classList.contains('g-btn-primary')).toBe(true)
    expect(buttons()[1].classList.contains('g-btn-secondary')).toBe(true)
    click(buttons()[0])
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onSkip).not.toHaveBeenCalled()
    click(buttons()[1])
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('links each button that has an href', () => {
    view.render(<PhaseOfferSheet startLabel="Start" startHref="#/go" skipLabel="Skip" skipHref="#/skip" />)
    expect(buttons().map(b => b.tagName)).toEqual(['A', 'A'])
    expect(buttons().map(b => b.getAttribute('href'))).toEqual(['#/go', '#/skip'])
  })

  it('leaves out the tag, the line and the list when the caller gives none', () => {
    view.render(<PhaseOfferSheet startLabel="Start" skipLabel="Skip" />)
    expect(tag()).toBeNull()
    expect(view.host.querySelector('p')).toBeNull()
    expect(view.host.querySelector('.g-offer-list')).toBeNull()
  })
})
