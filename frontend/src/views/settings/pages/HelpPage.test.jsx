// @vitest-environment happy-dom
// Help (board St1Help): six short answers in drawers, searchable, and the way to report a problem.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUI } from '../../../store/useUI.js'
import { BRAND } from '../../../brand.js'
import { PAGES, SEARCH, searchSettings } from '../../settings-pages.js'
import { HELP_TOPICS } from '../help-topics.js'
import HelpPage, { reportUrl } from './HelpPage.jsx'
import { HelpSheet } from './help-sheet.jsx'

vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let host, root, sheets
const titleOf = row => row.querySelector('b')?.textContent
const rows = () => [...host.querySelectorAll('.g-glist-row')]
const rowTitled = title => rows().find(r => titleOf(r) === title)
const Where = () => <output data-testid="where">{useLocation().pathname}</output>

beforeEach(() => {
  sheets = []
  useUI.setState({ openSheet: render => { sheets.push(render); return { close: vi.fn() } } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })

describe('Help page', () => {
  it('lists the six questions in order with their lines, then Report a problem; no Ask Adrian', () => {
    act(() => root.render(<HelpPage />))
    expect(host.querySelector('h1').textContent).toBe('Help')
    expect(rows().map(r => titleOf(r))).toEqual([...HELP_TOPICS.map(h => h.title), 'Report a problem'])
    expect(HELP_TOPICS).toHaveLength(6)
    expect(rowTitled('How the ring works').textContent).toContain('Left today, eaten, burned')
    expect(host.textContent).not.toContain('Ask Adrian')
  })

  it('every answer is three sentences or fewer', () => {
    for (const h of HELP_TOPICS) {
      const sentences = h.answer.split(/(?<=[.!?])\s+/).filter(Boolean)
      expect(sentences.length, h.id).toBeLessThanOrEqual(3)
    }
  })

  it('a row opens its answer in a drawer', () => {
    act(() => root.render(<HelpPage />))
    act(() => rowTitled('Offline and sync').click())
    expect(sheets).toHaveLength(1)
    const box = document.createElement('div')
    document.body.appendChild(box)
    const sheetRoot = createRoot(box)
    act(() => sheetRoot.render(<MemoryRouter>{sheets[0](vi.fn())}</MemoryRouter>))
    expect(box.querySelector('h2').textContent).toBe('Offline and sync')
    expect(box.textContent).toContain('Waiting to sync')
    act(() => sheetRoot.unmount())
    box.remove()
  })

  it('Report a problem opens a new bug report on GitHub with the app version filled in', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    act(() => root.render(<HelpPage />))
    act(() => rowTitled('Report a problem').click())
    expect(open).toHaveBeenCalledTimes(1)
    const url = new URL(open.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(BRAND.url + '/issues/new')
    expect(url.searchParams.get('environment')).toBe('Gains v' + BRAND.version)
    expect(reportUrl('9.9.9')).toContain(encodeURIComponent('Gains v9.9.9'))
  })
})

describe('Help drawer', () => {
  const draw = async (topic, entry = '/me/help') => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[entry]}>
          <Routes><Route path="*" element={<><HelpSheet topic={topic} close={vi.fn()} /><Where /></>} /></Routes>
        </MemoryRouter>,
      )
    })
  }
  const topic = id => HELP_TOPICS.find(h => h.id === id)

  it('offers a button to the page the answer is about, and it goes there', async () => {
    await draw(topic('plan'))
    const go = [...host.querySelectorAll('button')].find(b => b.textContent === 'Open Schedule')
    expect(go).toBeTruthy()
    await act(async () => { go.click() })
    expect(host.querySelector('[data-testid="where"]').textContent).toBe('/me/schedule')
  })

  it('leaves the button out where the page is not there for this profile (food off the web app)', async () => {
    await draw(topic('ring'))
    expect([...host.querySelectorAll('button')].some(b => b.textContent.startsWith('Open'))).toBe(false)
  })
})

describe('Help in the search', () => {
  const tr = s => s
  const ctx = { user: { id: 'u' }, mobile: false, nutrition: true }

  it('finds a question by its title and an answer by its words', () => {
    expect(searchSettings('how the ring', ctx, tr).map(h => h.title)).toContain('How the ring works')
    expect(searchSettings('waiting to sync', ctx, tr).map(h => h.title)).toContain('Offline and sync')
    expect(searchSettings('one-time code', ctx, tr).map(h => h.title)).toContain('Passkeys and devices')
    expect(searchSettings('help', ctx, tr)[0]).toMatchObject({ page: 'help', isPage: true })
  })

  it('every Help entry is a row on the page', () => {
    act(() => root.render(<HelpPage />))
    const have = rows().map(r => titleOf(r))
    for (const e of SEARCH.filter(e => e.page === 'help')) expect(have).toContain(e.title)
    expect(PAGES.help.title).toBe('Help')
  })
})
