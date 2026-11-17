// @vitest-environment happy-dom
// SetTable: the sets of an exercise as a table. Every word comes from the caller; a cell is a real
// field named for a screen reader, text, a button or nothing; a row can carry a remove button, the
// table an Add set.
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import SetTable from './SetTable.jsx'
import { click, type, useView } from './render.test-util.js'

const view = useView()
const COLUMNS = ['Set', 'Reps', 'Weight', 'Rest']
const field = label => view.host.querySelector(`input[aria-label="${label}"]`)
const leave = el => act(() => { el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })) })

describe('SetTable', () => {
  it('is a named table: a header row and a row a set, one cell for each column', () => {
    view.render(<SetTable label="Sets" columns={COLUMNS} rows={[
      { key: 1, cells: [{ text: '1', muted: true }, { text: '6–8' }, { text: '80 kg' }, { text: '2:30', muted: true }] },
      { key: 2, cells: [{ text: '2', muted: true }, { text: '6–8' }, { text: '80 kg' }, { text: '2:30', muted: true }] },
    ]} />)
    const table = view.host.querySelector('[role="table"]')
    expect(table.getAttribute('aria-label')).toBe('Sets')
    expect([...table.querySelectorAll('[role="columnheader"]')].map(h => h.textContent)).toEqual(COLUMNS)
    const rows = [...table.querySelectorAll('[role="row"]')]
    expect(rows).toHaveLength(3)
    expect(rows[2].querySelectorAll('[role="cell"]')).toHaveLength(4)
    expect(rows[2].textContent).toBe('26–880 kg2:30')
    expect(view.host.querySelector('.g-sett-rm')).toBeNull()
  })

  it('a field cell is a real input named by its label, and tells onChange what was typed', () => {
    const onReps = vi.fn(), onWeight = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[{ key: 'a', cells: [
      { text: '2' },
      { value: 8, onChange: onReps, label: 'Set 2 reps' },
      { value: 40, onChange: onWeight, label: 'Set 2 weight', decimal: true },
      null,
    ] }]} />)
    expect(field('Set 2 reps').value).toBe('8')
    expect(field('Set 2 weight').getAttribute('inputmode')).toBe('decimal')
    expect(field('Set 2 reps').getAttribute('inputmode')).toBe('numeric')
    type(field('Set 2 reps'), '10')
    expect(onReps).toHaveBeenLastCalledWith(10)
    type(field('Set 2 weight'), '42.5')
    expect(onWeight).toHaveBeenLastCalledWith(42.5)
    // a cell with nothing to enter is a dash a screen reader skips
    expect(view.host.querySelector('.g-sett-na').getAttribute('aria-hidden')).toBe('true')
  })

  it('holds a field to its minimum once it is left, not while it is typed in', () => {
    const onChange = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[{ key: 'a', cells: [{ text: '1' }, { value: 5, onChange, label: 'Set 1 reps', min: 1 }, null, null] }]} />)
    type(field('Set 1 reps'), '')
    expect(onChange).toHaveBeenLastCalledWith(0)
    onChange.mockClear()
    // the caller has stored the 0 it was told about
    view.render(<SetTable columns={COLUMNS} rows={[{ key: 'a', cells: [{ text: '1' }, { value: 0, onChange, label: 'Set 1 reps', min: 1 }, null, null] }]} />)
    leave(field('Set 1 reps'))
    expect(onChange).toHaveBeenLastCalledWith(1)
  })

  it('a button cell is named by its label and runs onClick', () => {
    const onClick = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[{ key: 'a', cells: [null, null, null, { text: '2:00', muted: true, label: 'Rest: Default (2:00)', onClick }] }]} />)
    const btn = view.host.querySelector('button[aria-label="Rest: Default (2:00)"]')
    expect(btn.textContent).toBe('2:00')
    expect(btn.classList.contains('g-sett-muted')).toBe(true)
    click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('an aux toggle follows a cell, pressed or not', () => {
    const onClick = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[
      { key: 1, cells: [null, { text: 'Max', aux: { text: 'Max', label: 'Set 1 max', pressed: true, onClick } }, null, null] },
      { key: 2, cells: [null, { value: 8, onChange: () => {}, label: 'Set 2 reps', aux: { text: 'Max', label: 'Set 2 max', pressed: false, onClick } }, null, null] },
    ]} />)
    expect(view.host.querySelector('button[aria-label="Set 1 max"]').getAttribute('aria-pressed')).toBe('true')
    expect(view.host.querySelector('button[aria-label="Set 2 max"]').getAttribute('aria-pressed')).toBe('false')
    click(view.host.querySelector('button[aria-label="Set 2 max"]'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('a row with remove has its own named button, and the grid makes room for it', () => {
    const remove = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[
      { key: 1, cells: [{ text: '1' }, null, null, null], remove: { label: 'Remove set 1', onClick: remove } },
      { key: 2, cells: [{ text: '2' }, null, null, null] },
    ]} />)
    expect(view.host.querySelectorAll('.g-sett-rm')).toHaveLength(3)
    expect(view.host.querySelectorAll('.g-sett-rmbtn')).toHaveLength(1)
    click(view.host.querySelector('button[aria-label="Remove set 1"]'))
    expect(remove).toHaveBeenCalledOnce()
  })

  it('Add set is the caller\'s word, and can be disabled', () => {
    const onClick = vi.fn()
    view.render(<SetTable columns={COLUMNS} rows={[]} add={{ label: 'Add set', onClick }} />)
    const add = view.host.querySelector('.g-sett-add')
    expect(add.textContent).toBe('Add set')
    click(add)
    expect(onClick).toHaveBeenCalledOnce()
    view.render(<SetTable columns={COLUMNS} rows={[]} add={{ label: 'Add set', onClick, disabled: true }} />)
    expect(view.host.querySelector('.g-sett-add').disabled).toBe(true)
  })

  it('draws no Add set without one', () => {
    view.render(<SetTable columns={COLUMNS} rows={[]} />)
    expect(view.host.querySelector('.g-sett-add')).toBeNull()
  })
})
