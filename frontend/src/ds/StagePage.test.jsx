// @vitest-environment happy-dom
// StagePage: the frame of a pushed page. The stage at half intensity, the nav bar with a named
// Back (the first tab stop), the optional large title and its line, then the body. Back is the
// tab's back (one step down its stack, or the parent for a page opened cold) unless told otherwise.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StagePage from './StagePage.jsx'
import { click, useView } from './render.test-util.js'
import { back } from '../lib/use-tab-nav.js'

vi.mock('../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

const view = useView()
const screen = () => view.host.firstElementChild
beforeEach(() => { back.mockClear() })

describe('StagePage', () => {
  it('is a pushed stage holding the nav bar, then the body', () => {
    view.render(<StagePage title="Routines"><p id="inside">Push A</p></StagePage>)
    expect(screen().classList.contains('g-screen-pushed')).toBe(true)
    const page = screen().querySelector('.g-spage')
    expect([...page.children].map(c => c.className)).toEqual(['g-snav', 'g-spage-body'])
    expect(page.querySelector('.g-snav-title').textContent).toBe('Routines')
    expect(page.querySelector('.g-spage-body #inside')).not.toBeNull()
  })

  it('makes Back the first thing to tab to, named Back unless backLabel says where it goes', () => {
    view.render(<StagePage title="Plan" largeTitle="Plan" actions={[{ icon: 'gear', label: 'Plan settings', onClick: () => {} }]}><button type="button">Row</button></StagePage>)
    const focusable = screen().querySelector('button, a')
    expect(focusable.classList.contains('g-snav-back')).toBe(true)
    expect(focusable.getAttribute('aria-label')).toBe('Back')
    view.render(<StagePage title="Plan" backLabel="Back to Train" />)
    expect(screen().querySelector('.g-snav-back').getAttribute('aria-label')).toBe('Back to Train')
  })

  it('passes the actions to the bar', () => {
    const onClick = vi.fn()
    view.render(<StagePage title="Plan" actions={[{ icon: 'gear', label: 'Plan settings', onClick }]} />)
    const action = screen().querySelector('.g-snav-end button')
    expect(action.getAttribute('aria-label')).toBe('Plan settings')
    click(action)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('draws a large title with its line, as the page heading when the bar has no title', () => {
    view.render(<StagePage largeTitle="Plan" sub="Push A, Pull A, Legs"><p>Body</p></StagePage>)
    const title = screen().querySelector('.g-spage-title')
    expect(title.tagName).toBe('H1')
    expect(title.textContent).toBe('Plan')
    expect(screen().querySelector('.g-spage-sub').textContent).toBe('Push A, Pull A, Legs')
    expect(screen().querySelector('.g-snav-title')).toBeNull()
  })

  it('leaves the large title a second-level heading under a bar that has its own title', () => {
    view.render(<StagePage title="Plan" largeTitle="Next week" />)
    expect(screen().querySelector('.g-spage-title').tagName).toBe('H2')
    expect(screen().querySelector('.g-spage-sub')).toBeNull()
  })

  it('draws no large title without largeTitle', () => {
    view.render(<StagePage title="Routines" sub="ignored without a large title" />)
    expect(screen().querySelector('.g-spage-head')).toBeNull()
  })

  it('goes back one step of the tab\'s stack, or to the parent page, by default', () => {
    view.render(<StagePage title="Plan" parent="/train" />)
    click(screen().querySelector('.g-snav-back'))
    expect(back).toHaveBeenCalledWith('/train')
    view.render(<StagePage title="Plan" />)
    click(screen().querySelector('.g-snav-back'))
    expect(back).toHaveBeenLastCalledWith(undefined)
  })

  it('goes where onBack says instead', () => {
    const onBack = vi.fn()
    view.render(<StagePage title="Plan" parent="/train" onBack={onBack} />)
    click(screen().querySelector('.g-snav-back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(back).not.toHaveBeenCalled()
  })

  it('takes its accent from the prop, else the person\'s', () => {
    view.render(<StagePage title="Plan" accent="moss" />)
    expect(screen().dataset.accent).toBe('moss')
    view.render(<StagePage title="Plan" />)
    expect(screen().dataset.accent).toMatch(/^(cobalt|moss|ember|tide|plum|ink)$/)
  })
})
