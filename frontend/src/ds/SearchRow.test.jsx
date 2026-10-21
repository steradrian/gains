// @vitest-environment happy-dom
// SearchRow and BestMatch: a result on the stage, what matched in bold, the picture slot, Recent's ×.
import { describe, expect, it, vi } from 'vitest'
import BestMatch from './BestMatch.jsx'
import SearchRow from './SearchRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = s => view.host.querySelector(s)

describe('SearchRow', () => {
  it('is one button: picture, title with the match marked, its line; named by both', () => {
    const onClick = vi.fn()
    view.render(<SearchRow title="Bench press" ranges={[[6, 11]]} sub="Exercise · best set 80 kg × 6" media={{ kind: 'glyph', glyph: 'dumbbell' }} onClick={onClick} />)
    const main = q('.g-srow-main')
    expect(main.tagName).toBe('BUTTON')
    expect(q('.g-hl').textContent).toBe('press')
    expect(q('.g-srow-title').textContent).toBe('Bench press')
    expect(q('.g-srow-sub').textContent).toBe('Exercise · best set 80 kg × 6')
    expect(main.getAttribute('aria-label')).toBe('Bench press, Exercise · best set 80 kg × 6')
    expect(q('.g-srow-media svg')).not.toBeNull()
    click(main)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(q('.g-srow-xbtn')).toBeNull()
  })

  it('a Recent row has its own ×, named for what it removes', () => {
    const onRemove = vi.fn(), onClick = vi.fn()
    view.render(<SearchRow title="press" sub="Search" media={{ kind: 'glyph', glyph: 'clock' }} onClick={onClick} onRemove={onRemove} />)
    const x = q('.g-srow-xbtn')
    expect(x.getAttribute('aria-label')).toBe('Remove press from recent')
    click(x)
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('draws a date block, a photo, a link, and takes a listbox option\'s props', () => {
    view.render(<SearchRow title="Mon 12 Oct" media={{ kind: 'date', iso: '2026-10-12' }} href="#/day" optionProps={{ role: 'option', id: 'sr-day', 'aria-selected': true }} />)
    expect(q('.g-srow-date b').textContent).toBe('12')
    expect(q('.g-srow-main').tagName).toBe('A')
    expect(q('.g-srow-main').getAttribute('role')).toBe('option')
    expect(q('.g-srow-main').id).toBe('sr-day')
    view.render(<SearchRow title="Oats" media={{ kind: 'photo', src: '/o.jpg' }} />)
    expect(q('img.g-srow-img').getAttribute('src')).toBe('/o.jpg')
    expect(q('img.g-srow-img').getAttribute('alt')).toBe('')
  })
})

describe('BestMatch', () => {
  it('says Best match and the kind over the title, the whole card one button', () => {
    const onClick = vi.fn()
    view.render(<BestMatch kind="Exercise" title="Bench press" ranges={[[6, 11]]} sub="Best set 80 kg × 6" media={{ kind: 'glyph', glyph: 'dumbbell' }} onClick={onClick} />)
    const card = q('.g-best')
    expect(card.tagName).toBe('BUTTON')
    expect(q('.g-best-body > span').textContent).toBe('Best match · Exercise')
    expect(q('.g-best-body b .g-hl').textContent).toBe('press')
    expect(card.getAttribute('aria-label')).toBe('Best match · Exercise, Bench press, Best set 80 kg × 6')
    expect(q('.g-best-img.g-best-ic')).not.toBeNull()
    click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a link with an href', () => {
    view.render(<BestMatch kind="Page" title="History" href="#/train/history" />)
    expect(q('.g-best').getAttribute('href')).toBe('#/train/history')
  })
})
