// @vitest-environment happy-dom
// Licences: the AGPL notice and the third-party attributions, word for word as NOTICE.md has them
// (the Gym visual agreement, §8c, asks for the media line verbatim); links are rows, not text links.
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BRAND, LINKS } from '../../../brand.js'
import LicencesPage from './LicencesPage.jsx'

const opened = vi.hoisted(() => [])
vi.mock('../../../components/CustomMedia.jsx', () => ({ openExternal: url => opened.push(url) }))
vi.mock('../../../lib/use-tab-nav.js', () => ({ back: vi.fn() }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  opened.length = 0
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root.render(<LicencesPage />))
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const text = () => host.textContent
const row = title => [...host.querySelectorAll('[data-find]')].find(r => r.dataset.find === title)

describe('Licences', () => {
  it('keeps the legal wording intact', () => {
    expect(host.querySelector('h1').textContent).toBe('Licences')
    expect(text()).toContain(`${BRAND.name} v${BRAND.version}`)
    for (const line of LINKS.copyright) expect(text()).toContain(line)
    expect(text()).toContain('Free software, licensed under the GNU Affero General Public License v3.0 or later. You may redistribute and modify it under those terms.')
    expect(text()).toContain('It comes with no warranty, to the extent the law allows.')
    expect(text()).toContain('Exercise media © Aliaksandr Makatserchyk, Gym visual, gymvisual.com. Media licensed for use in openGym only; see NOTICE.md')
    expect(text()).toContain('MuscleMap © 2026 Melih Colpan, MIT License.')
    expect(text()).toContain('ExerciseDB v1 by AscendAPI, via hasaneyldrm/exercises-dataset © 2026 Hasan Emir Yıldırım, MIT License.')
    expect(text()).toContain('Nutrition icons derived from Lucide, ISC License, © Lucide Contributors; portions © 2013-2022 Cole Bemis (Feather), MIT License.')
  })

  it('credits the upstream version, not Gains\' own, and names Gains\' own version in the heading', () => {
    expect(text()).toContain(`Built on openGym v${globalThis.__APP_VERSION__} by Duarte Santos.`)
    expect(text()).toContain(`Gains v${BRAND.version}`)
  })

  it('has no text links: the links the notices name are rows that open them', () => {
    expect(host.querySelectorAll('a')).toHaveLength(0)
    act(() => row('Full licence text').click())
    act(() => row('NOTICE.md').click())
    act(() => row('Gym visual').click())
    act(() => row('Lucide').click())
    act(() => row(LINKS.source[0].label).click())
    expect(opened).toEqual([LINKS.upstream.license, LINKS.upstream.notice, LINKS.media.url, LINKS.lucide.url, LINKS.source[0].url])
  })
})
