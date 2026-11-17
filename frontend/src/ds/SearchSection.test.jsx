// @vitest-environment happy-dom
// SearchSection and GoToChips: the search's uppercase-headed sections on the stage.
import { describe, expect, it, vi } from 'vitest'
import GoToChips from './GoToChips.jsx'
import SearchSection from './SearchSection.jsx'
import { click, useView } from './render.test-util.js'

const view = useView()
const q = s => view.host.querySelector(s)

describe('SearchSection', () => {
  it('names its section by its heading and holds its rows in one glass card', () => {
    view.render(<SearchSection title="Recent"><span className="row">a</span></SearchSection>)
    const h = q('h2')
    expect(h.textContent).toBe('Recent')
    expect(q('section').getAttribute('aria-labelledby')).toBe(h.id)
    expect(q('.g-scard.g-glass .row')).not.toBeNull()
  })

  it('has an action on the right when given one', () => {
    const onAction = vi.fn()
    view.render(<SearchSection title="Recent" action="Clear" onAction={onAction}>x</SearchSection>)
    click(q('.g-ssect-act'))
    expect(onAction).toHaveBeenCalledTimes(1)
    view.render(<SearchSection title="Exercises" action="See all 4" actionHref="#/x">x</SearchSection>)
    expect(q('.g-ssect-act').getAttribute('href')).toBe('#/x')
  })

  it('a bare section has no card; a listbox group is named by the heading', () => {
    view.render(<SearchSection title="Best" card={false}><b>x</b></SearchSection>)
    expect(q('.g-scard')).toBeNull()
    view.render(<SearchSection title="Recent" groupProps={{ role: 'group' }}>x</SearchSection>)
    expect(q('.g-scard').getAttribute('role')).toBe('group')
    expect(q('.g-scard').getAttribute('aria-labelledby')).toBe(q('h2').id)
  })
})

describe('GoToChips', () => {
  it('is a row of glass chips under Go to, each a button or a link', () => {
    const onClick = vi.fn()
    view.render(<GoToChips items={[{ id: 'h', label: 'History', icon: 'history', onClick }, { id: 'b', label: 'Body', icon: 'scale', href: '#/progress/body' }]} />)
    expect(q('h2').textContent).toBe('Go to')
    const chips = [...view.host.querySelectorAll('.g-goto-chip')]
    expect(chips.map(c => [c.tagName, c.textContent])).toEqual([['BUTTON', 'History'], ['A', 'Body']])
    expect(chips[0].querySelector('svg')).not.toBeNull()
    expect(chips.map(c => c.getAttribute('data-glass'))).toEqual(['flat', 'flat'])
    click(chips[0])
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
