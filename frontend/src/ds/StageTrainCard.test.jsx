// @vitest-environment happy-dom
// StageTrainCard (boards T2.0, T2.3, T2.7, T2.10, T2.11, T2.14): eyebrow, name, what is in it, the buttons.
import { describe, expect, it, vi } from 'vitest'
import StageTrainCard from './StageTrainCard.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = sel => view.host.querySelector(sel)
const buttons = () => [...view.host.querySelectorAll('.g-tcard-btn')]

describe('StageTrainCard', () => {
  it('planned today: the eyebrow, the name and meta, a stack of pictures, one white button and the ⋯', () => {
    const start = vi.fn()
    const menu = vi.fn()
    view.render(
      <StageTrainCard
        eyebrow="Today · planned"
        title="Push A"
        meta="Chest, shoulders, triceps · 6 exercises · about 55 min"
        thumbs={['/a.png', '/b.png', null]}
        actions={[{ label: 'Start Push A', icon: 'play', solid: true, onClick: start }]}
        onMenu={menu}
      />,
    )
    expect(q('.g-tag').textContent).toBe('Today · planned')
    expect(q('.g-tcard-head b').textContent).toBe('Push A')
    expect(q('.g-tcard-head span').textContent).toContain('about 55 min')
    expect(view.host.querySelectorAll('.g-tcard-stack img')).toHaveLength(2)
    expect(view.host.querySelectorAll('.g-tcard-stack > span')).toHaveLength(3)
    expect(buttons().map(b => [b.textContent, b.classList.contains('solid')])).toEqual([['Start Push A', true]])
    click(buttons()[0])
    expect(start).toHaveBeenCalledTimes(1)
    const more = q('.g-tcard-menu')
    expect(more.getAttribute('aria-label')).toBe('Day options')
    click(more)
    expect(menu).toHaveBeenCalledTimes(1)
  })

  it('shows at most six pictures in the stack', () => {
    view.render(<StageTrainCard eyebrow="e" title="t" thumbs={Array.from({ length: 9 }, (_, i) => `/${i}.png`)} />)
    expect(view.host.querySelectorAll('.g-tcard-stack img')).toHaveLength(6)
  })

  it('running: the clock in the eyebrow, a progress bar that is a share of the width, Resume', () => {
    view.render(<StageTrainCard eyebrow="In progress · 24:18" title="Push A" meta="3 of 6 exercises" progress={0.5} actions={[{ label: 'Resume', icon: 'play', solid: true, href: '#/train/workout' }]} />)
    expect(q('.g-tcard-bar i').style.getPropertyValue('--p')).toBe('0.5')
    expect(q('.g-tcard-bar').getAttribute('aria-hidden')).toBe('true')
    expect(buttons()[0].tagName).toBe('A')
  })

  it('keeps the bar within 0 and 1 and draws none without progress', () => {
    view.render(<StageTrainCard eyebrow="e" title="t" progress={3} />)
    expect(q('.g-tcard-bar i').style.getPropertyValue('--p')).toBe('1')
    view.render(<StageTrainCard eyebrow="e" title="t" />)
    expect(q('.g-tcard-bar')).toBeNull()
  })

  it('rest: two equal glass buttons and no ⋯ without a handler', () => {
    view.render(<StageTrainCard eyebrow="Rest day" title="Recover" meta="Next: Legs, Mon 19 Oct" actions={[{ label: 'Train anyway', icon: 'play' }, { label: 'See Monday' }]} />)
    expect(buttons().map(b => b.classList.contains('solid'))).toEqual([false, false])
    expect(q('.g-tcard-menu')).toBeNull()
    expect(q('.g-tcard-stack')).toBeNull()
  })

  it('a later week: both tags, read-only exercise rows with their pictures, then the buttons', () => {
    view.render(
      <StageTrainCard
        eyebrow="Sat 24 Oct"
        chip="Planned"
        title="Legs"
        meta="6 exercises · about 60 min · read-only until the day"
        exercises={[
          { name: 'Barbell full squat', sub: '4 × 5 · 100 kg', image: '/squat.png' },
          { name: 'Sled 45° leg press', sub: '3 × 10–12 · 160 kg' },
        ]}
        actions={[{ label: 'Change this day', icon: 'calendar' }, { label: 'Edit routine' }]}
      />,
    )
    expect([...view.host.querySelectorAll('.g-tag')].map(t => t.textContent)).toEqual(['Sat 24 Oct', 'Planned'])
    const rows = [...view.host.querySelectorAll('.g-tcard-rows .g-xrow')]
    expect(rows.map(r => r.querySelector('.g-xrow-b').textContent)).toEqual(['Barbell full squat4 × 5 · 100 kg', 'Sled 45° leg press3 × 10–12 · 160 kg'])
    expect(rows.every(r => r.classList.contains('g-xrow-stage') && r.classList.contains('g-xrow-sm'))).toBe(true)
    expect(rows.map(r => r.classList.contains('g-xrow-line'))).toEqual([false, true])
    expect(rows[0].tagName).toBe('DIV')
    expect(q('.g-tcard-acts').classList.contains('tight')).toBe(true)
    expect(buttons().map(b => b.textContent)).toEqual(['Change this day', 'Edit routine'])
  })

  it('an exercise row is a link or button only with a tap', () => {
    const open = vi.fn()
    view.render(<StageTrainCard eyebrow="e" title="t" exercises={[{ name: 'A', onClick: open }, { name: 'B' }]} />)
    const rows = [...view.host.querySelectorAll('.g-xrow')]
    expect(rows.map(r => r.tagName)).toEqual(['BUTTON', 'DIV'])
    click(rows[0])
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('the ⋯ takes the caller\'s name and can be a link', () => {
    view.render(<StageTrainCard eyebrow="e" title="t" menuHref="#/options" menuLabel="Opciones del día" />)
    expect(q('.g-tcard-menu').tagName).toBe('A')
    expect(q('.g-tcard-menu').getAttribute('aria-label')).toBe('Opciones del día')
  })

  it('a card with nothing to do draws no button row', () => {
    view.render(<StageTrainCard eyebrow="Workout done" title="Push A" meta="52 min" />)
    expect(q('.g-tcard-acts')).toBeNull()
  })
})
