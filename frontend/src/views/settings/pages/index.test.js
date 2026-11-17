// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { PAGES, pageExists } from '../../settings-pages.js'
import { PAGE_COMPONENTS, pageComponent } from './index.js'

describe('Settings page components', () => {
  // A page with a route here: not one that lives in a tab (`to`), a sheet, or Gym setup, which
  // SettingsRoute draws itself.
  const rendersInSettings = id => pageExists(id, { user: { id: 'u' }, mobile: false }) || pageExists(id, { user: null, mobile: true })

  it('every page that renders in Settings has a component', () => {
    const missing = Object.keys(PAGES).filter(id => id !== 'equipment' && rendersInSettings(id) && !PAGE_COMPONENTS[id])
    expect(missing).toEqual([])
  })

  it('no component is registered for a page that does not exist', () => {
    expect(Object.keys(PAGE_COMPONENTS).filter(id => !(id in PAGES) || PAGES[id].to || PAGES[id].sheet)).toEqual([])
  })

  it('an unknown id has none', () => {
    expect(pageComponent('nope')).toBeNull()
  })
})
