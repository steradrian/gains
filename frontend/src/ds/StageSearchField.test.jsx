// @vitest-environment happy-dom
// StageSearchField: the overlay's head with its scope chip and ×, and the in-page field with its
// clear button and live count. Every spoken name comes from the caller.
import { describe, expect, it, vi } from 'vitest'
import StageSearchField from './StageSearchField.jsx'
import { click, type, useView } from './render.test-util.js'

const view = useView()
const input = () => view.host.querySelector('input')

describe('StageSearchField', () => {
  it('is a search input named by the caller, with the caller\'s placeholder', () => {
    view.render(<StageSearchField placeholder="Search 12 exercises" label="Search exercises" onChange={() => {}} query="" />)
    expect(input().type).toBe('search')
    expect(input().placeholder).toBe('Search 12 exercises')
    expect(input().getAttribute('aria-label')).toBe('Search exercises')
  })

  it('tells onChange what is typed, and shows the text it is given when controlled', () => {
    const onChange = vi.fn()
    view.render(<StageSearchField query="curl" onChange={onChange} />)
    expect(input().value).toBe('curl')
    type(input(), 'curls')
    expect(onChange).toHaveBeenCalledWith('curls')
  })

  it('in a page: no close, a clear button only while there is text, and it empties the text', () => {
    const onChange = vi.fn()
    view.render(<StageSearchField query="" onChange={onChange} clearLabel="Clear" />)
    expect(view.host.querySelector('.g-ssf-clear')).toBeNull()
    expect(view.host.querySelector('.g-ssf-close')).toBeNull()
    expect(view.host.querySelector('.g-ssf-page')).not.toBeNull()
    view.render(<StageSearchField query="bench" onChange={onChange} clearLabel="Clear" />)
    const clear = view.host.querySelector('.g-ssf-clear')
    expect(clear.getAttribute('aria-label')).toBe('Clear')
    click(clear)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('has no clear button without a spoken name for it', () => {
    view.render(<StageSearchField query="bench" onChange={() => {}} />)
    expect(view.host.querySelector('.g-ssf-clear')).toBeNull()
  })

  it('says the live count as a status, in the caller\'s words', () => {
    view.render(<StageSearchField query="bench" onChange={() => {}} count="12" countLabel="12 exercises" />)
    const count = view.host.querySelector('.g-ssf-count')
    expect(count.textContent).toBe('12')
    expect(count.getAttribute('role')).toBe('status')
    expect(count.getAttribute('aria-label')).toBe('12 exercises')
    view.render(<StageSearchField query="" onChange={() => {}} />)
    expect(view.host.querySelector('.g-ssf-count')).toBeNull()
  })

  it('as the overlay\'s head: a close button, named by the caller, and a removable scope', () => {
    const onClose = vi.fn()
    const onClearScope = vi.fn()
    view.render(<StageSearchField query="" onChange={() => {}} onClose={onClose} closeLabel="Close search" scope="Training" onClearScope={onClearScope} scopeLabel="Remove the Training scope" />)
    expect(view.host.querySelector('.g-ssf-page')).toBeNull()
    expect(view.host.querySelector('.g-ssf-scope').textContent).toBe('Training')
    click(view.host.querySelector('.g-ssf-close'))
    expect(onClose).toHaveBeenCalled()
    click(view.host.querySelector('.g-ssf-scope-x'))
    expect(onClearScope).toHaveBeenCalled()
    expect(view.host.querySelector('.g-ssf-scope-x').getAttribute('aria-label')).toBe('Remove the Training scope')
  })

  it('shows neither the count nor the clear button in the overlay', () => {
    view.render(<StageSearchField query="x" onChange={() => {}} onClose={() => {}} clearLabel="Clear" count="3" />)
    expect(view.host.querySelector('.g-ssf-count')).toBeNull()
    expect(view.host.querySelector('.g-ssf-clear')).toBeNull()
  })
})
