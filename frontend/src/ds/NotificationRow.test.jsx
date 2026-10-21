// @vitest-environment happy-dom
// NotificationRow: the whole row is the one control; the kind picks the glyph; a new row says
// "New:" aloud and not only with its dot.
import { describe, expect, it, vi } from 'vitest'
import NotificationRow, { NOTIFICATION_KINDS } from './NotificationRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.querySelector('.g-nrow')
const glyph = () => view.host.querySelector('.g-lead svg')?.outerHTML

describe('NotificationRow', () => {
  it('says the title, the line and the meta line, in one button', () => {
    const onClick = vi.fn()
    view.render(<NotificationRow kind="coach" title="Coach moved Legs" body="It wasn’t logged." when="Coach · 2 h ago" onClick={onClick} />)
    expect(row().tagName).toBe('BUTTON')
    expect(row().querySelector('b').textContent).toBe('Coach moved Legs')
    expect(row().querySelector('.g-nrow-body > span').textContent).toBe('It wasn’t logged.')
    expect(row().querySelector('small').textContent).toBe('Coach · 2 h ago')
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is a link with an href, and holds no control inside', () => {
    view.render(<NotificationRow title="x" href="#/day/2026-10-19" />)
    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('#/day/2026-10-19')
    expect(row().querySelector('a, button')).toBeNull()
  })

  it('leaves out the line and the meta line when it has none', () => {
    view.render(<NotificationRow title="x" onClick={() => {}} />)
    expect(row().querySelector('.g-nrow-body > span')).toBeNull()
    expect(row().querySelector('small')).toBeNull()
  })

  it('draws a different glyph for every kind', () => {
    const seen = new Set()
    for (const kind of NOTIFICATION_KINDS) {
      view.render(<NotificationRow kind={kind} title="x" />)
      seen.add(glyph())
    }
    expect(seen.size).toBe(NOTIFICATION_KINDS.length)
  })

  it('lets the caller pick the glyph, for a reminder about a workout or a weigh-in', () => {
    view.render(<NotificationRow kind="reminder" title="x" />)
    const bell = glyph()
    view.render(<NotificationRow kind="reminder" icon="scale" title="x" />)
    expect(glyph()).not.toBe(bell)
  })

  it('draws the exercise still instead of a glyph for a new best, hidden from a screen reader', () => {
    view.render(<NotificationRow kind="best" image="/bench.png" title="New best: Bench press" />)
    const img = view.host.querySelector('img.g-lead-img')
    expect(img.getAttribute('src')).toBe('/bench.png')
    expect(img.getAttribute('alt')).toBe('')
    expect(view.host.querySelector('.g-lead svg')).toBeNull()
  })

  it('lights a new row, with the dot and a spoken "New:" before the title', () => {
    view.render(<NotificationRow title="Coach moved Legs" isNew onClick={() => {}} />)
    expect(row().classList.contains('g-nrow-new')).toBe(true)
    expect(row().querySelector('.g-nrow-dot').getAttribute('aria-hidden')).toBe('true')
    expect(row().querySelector('b .g-sr').textContent).toBe('New: ')
    expect(row().textContent.startsWith('New: Coach moved Legs')).toBe(true)
  })

  it('holds the dot’s place on a read row, and says nothing about it', () => {
    view.render(<NotificationRow title="6 weeks on plan" onClick={() => {}} />)
    expect(row().classList.contains('g-nrow-new')).toBe(false)
    expect(row().querySelector('.g-nrow-dot')).toBeNull()
    expect(row().querySelector('.g-nrow-gap')).not.toBeNull()
    expect(row().querySelector('.g-sr')).toBeNull()
  })

  it('refuses a kind it has no glyph for, in development', () => {
    expect(() => view.render(<NotificationRow kind="cheer" title="x" />)).toThrow(/kind="cheer"/)
  })
})
