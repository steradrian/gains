// @vitest-environment happy-dom
// StageEmpty (board T2.9): an icon or a scene, a title, a line and the buttons the page offers.
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import StageEmpty from './StageEmpty.jsx'
import { EMPTY_SCENE_NAMES } from './empty-scenes.js'
import { click, useView } from './render.test-util.js'

const view = useView()
const buttons = () => [...view.host.querySelectorAll('.g-sempty-btn')]

describe('StageEmpty', () => {
  it('says a title and a line on a glass card, with the icon in a disc', () => {
    view.render(<StageEmpty icon="calendar" title="Nothing here yet" body="Plan a week to see it." />)
    const root = view.host.querySelector('.g-sempty')
    expect(root.classList.contains('g-glass')).toBe(true)
    expect(root.querySelector('b').textContent).toBe('Nothing here yet')
    expect(root.textContent).toContain('Plan a week to see it.')
    expect(root.querySelector('.g-sempty-ic svg')).not.toBeNull()
    expect(buttons()).toHaveLength(0)
  })

  it('its buttons are glass, except the solid one and any on the light tone', () => {
    view.render(<StageEmpty title="Nothing" action="Add" onClick={() => {}} actions={[{ label: 'Browse', onClick: () => {} }]} />)
    expect(buttons().map(b => b.classList.contains('g-glass'))).toEqual([false, true])
    view.render(<StageEmpty title="Nothing" tone="light" actions={[{ label: 'Browse', onClick: () => {} }]} />)
    expect(buttons()[0].classList.contains('g-glass')).toBe(false)
  })

  it('card={false} sits bare on the stage', () => {
    view.render(<StageEmpty title="No results" card={false} />)
    expect(view.host.querySelector('.g-sempty').className).not.toContain('g-glass')
  })

  it('an illustration replaces the disc', () => {
    view.render(<StageEmpty illustration="plan" title="Add training" />)
    expect(view.host.querySelector('.g-sempty-ic')).toBeNull()
    expect(view.host.querySelector('.g-ill-stage')).not.toBeNull()
  })

  it('stacks the scene, then the title, then the line, centred', () => {
    view.render(<StageEmpty card={false} illustration="bell" title="Nothing new" body="Streaks and new bests show up here." />)
    const root = view.host.querySelector('.g-sempty')
    expect([...root.children].map(c => c.tagName + (c.classList.contains('g-ill') ? '.ill' : ''))).toEqual(['DIV.ill', 'B', 'SPAN'])
    const css = readFileSync(join(process.cwd(), 'src/ds/ds.css'), 'utf8')
    expect(css).toMatch(/\.g-sempty \{ display: flex; flex-direction: column; align-items: center; text-align: center;/)
  })

  it('draws every one of its line-art scenes in, and holds the finished drawing under reduced motion', () => {
    for (const name of EMPTY_SCENE_NAMES) {
      view.render(<StageEmpty illustration={name} title="t" />)
      const art = view.host.querySelector('.g-ill-stage')
      expect(art.classList.contains('g-ill-draw'), name).toBe(true)
      expect(art.querySelectorAll('[pathLength="1"].dr').length, name).toBeGreaterThan(0)
    }
    document.documentElement.dataset.motion = 'reduce'
    try {
      view.render(<StageEmpty illustration="bell" title="t" />)
      const art = view.host.querySelector('.g-ill-stage')
      expect(art.classList.contains('g-ill-draw')).toBe(false)
      expect(art.querySelectorAll('.dr, .fd')).toHaveLength(0)
      expect(art.querySelectorAll('path').length).toBeGreaterThan(0)
    } finally {
      delete document.documentElement.dataset.motion
    }
  })

  it('action is the one white button, a link with an href', () => {
    const onClick = vi.fn()
    view.render(<StageEmpty title="t" action="Pick a plan" onClick={onClick} />)
    expect(buttons().map(b => [b.tagName, b.textContent, b.classList.contains('solid')])).toEqual([['BUTTON', 'Pick a plan', true]])
    click(buttons()[0])
    expect(onClick).toHaveBeenCalledTimes(1)
    view.render(<StageEmpty title="t" action="Pick a plan" href="#/plans" />)
    expect(buttons()[0].tagName).toBe('A')
  })

  it('a button with haptic is a haptic host and still runs its handler once', () => {
    const onClick = vi.fn()
    view.render(<StageEmpty title="t" actions={[{ label: 'Create a group', onClick, haptic: true }, { label: 'Join', onClick: () => {} }]} />)
    expect(buttons().map(b => b.classList.contains('g-haptic'))).toEqual([true, false])
    click(buttons()[0])
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('actions add glass buttons under the white one, in order, with an optional icon (T2.9)', () => {
    const importIt = vi.fn()
    view.render(
      <StageEmpty
        title="Add training"
        action="Pick a ready-made plan"
        href="#/plans"
        actions={[{ label: 'Create a routine', href: '#/new' }, { label: 'Import a plan file', icon: 'folder', onClick: importIt }]}
      />,
    )
    expect(buttons().map(b => b.textContent)).toEqual(['Pick a ready-made plan', 'Create a routine', 'Import a plan file'])
    expect(buttons().map(b => b.classList.contains('solid'))).toEqual([true, false, false])
    expect(buttons()[2].querySelector('svg')).not.toBeNull()
    click(buttons()[2])
    expect(importIt).toHaveBeenCalledTimes(1)
  })
})
