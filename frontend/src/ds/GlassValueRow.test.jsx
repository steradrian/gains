// @vitest-environment happy-dom
// GlassValueRow: a row with a value before the chevron. One that goes somewhere is a button or a
// link with a chevron; a static one, or one with nowhere to go, is plain text.
import { describe, expect, it, vi } from 'vitest'
import GlassValueRow from './GlassValueRow.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const row = () => view.host.firstElementChild

describe('GlassValueRow', () => {
  it('a row with a handler is a button with the value and a chevron, and calls it', () => {
    const onClick = vi.fn()
    view.render(<GlassValueRow icon="scale" title="Weight" sub="Today" value="78.4 kg" onClick={onClick} />)
    expect(row().tagName).toBe('BUTTON')
    expect(row().querySelector('.g-gvr-val').textContent).toBe('78.4 kg')
    expect(row().querySelector('.g-glist-chev')).not.toBeNull()
    expect(row().querySelector('.g-glist-ic')).not.toBeNull()
    click(row())
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('a row with an href is a link', () => {
    view.render(<GlassValueRow title="Target" value="75 kg" href="#/me" />)
    expect(row().tagName).toBe('A')
    expect(row().getAttribute('href')).toBe('#/me')
  })

  it('static is a div: no button, no chevron, even with a handler', () => {
    view.render(<GlassValueRow title="Started" value="12 Sep" static onClick={() => {}} />)
    expect(row().tagName).toBe('DIV')
    expect(row().classList.contains('g-gvr-static')).toBe(true)
    expect(row().querySelector('.g-glist-chev')).toBeNull()
    expect(view.host.querySelector('button, a')).toBeNull()
  })

  it('a row with neither a handler nor a link says something and opens nothing', () => {
    view.render(<GlassValueRow title="Started" value="12 Sep" />)
    expect(row().tagName).toBe('DIV')
    expect(row().querySelector('.g-glist-chev')).toBeNull()
  })

  it('trailing replaces the chevron, and chevron={false} drops it', () => {
    view.render(<GlassValueRow title="Rest timer" value="90 s" trailing={<span id="t">Auto</span>} onClick={() => {}} />)
    expect(row().querySelector('#t')).not.toBeNull()
    expect(row().querySelector('.g-glist-chev')).toBeNull()
    view.render(<GlassValueRow title="Rest timer" value="90 s" chevron={false} onClick={() => {}} />)
    expect(row().querySelector('.g-glist-chev')).toBeNull()
  })

  it('shows a value of 0, and none when there is none', () => {
    view.render(<GlassValueRow title="Sets" value={0} static />)
    expect(row().querySelector('.g-gvr-val').textContent).toBe('0')
    view.render(<GlassValueRow title="Sets" static />)
    expect(row().querySelector('.g-gvr-val')).toBeNull()
  })
})
