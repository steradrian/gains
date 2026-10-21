// @vitest-environment happy-dom
// The equipment profile drawer (Gym setup → New / Edit profile, T12.1): a name and the equipment
// types as a checklist, Save, and for an existing profile Delete profile, which deletes at once and
// leaves an Undo in the toast instead of asking first.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore, DEF } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { equipmentProfileSheet } from './sheets.jsx'

const mounted = []
function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const S = () => useStore.getState().S
const home = { id: 'home', name: 'Home', equipment: ['dumbbell', 'bench'], accV: 1 }
const city = { id: 'city', name: 'City Gym', equipment: ['barbell'], accV: 1 }
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const box = (host, label) => [...host.querySelectorAll('[role="checkbox"]')].find(b => b.textContent === label)
const typeName = (host, value) => {
  const input = host.querySelector('.g-tfield input')
  act(() => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const setProfiles = (profiles, activeEquipId) => useStore.setState(s => ({ S: { ...s.S, equipProfiles: profiles, activeEquipId } }))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toasts: [], toastMsg: '', toastAction: null })
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), unit: 'kg' }, user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('new profile', () => {
  it('is a full design-system drawer with a name field and the equipment as a checklist', () => {
    act(() => equipmentProfileSheet(null))
    expect(useUI.getState().sheets.at(-1).variant).toBe('ds')
    const host = mountTopSheet()
    expect(host.querySelector('.g-bs-head h2').textContent).toBe('New equipment profile')
    expect(host.querySelector('.g-bs-full')).not.toBeNull()
    expect(host.querySelector('.g-tfield-label').textContent).toBe('Profile name')
    expect(host.querySelector('.g-tfield input').maxLength).toBe(40)
    expect(box(host, 'dumbbell').getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('Body-weight exercises are always available')
    expect(button(host, 'Delete profile')).toBeUndefined()
  })

  it('cannot be saved without a name', () => {
    act(() => equipmentProfileSheet(null))
    const host = mountTopSheet()
    expect(button(host, 'Save').disabled).toBe(true)
    typeName(host, '   ')
    expect(button(host, 'Save').disabled).toBe(true)
    act(() => button(host, 'Save').click())
    expect(S().equipProfiles || []).toHaveLength(0)
  })

  it('saves the name and what was ticked, makes the first profile the active one, and closes', () => {
    act(() => equipmentProfileSheet(null))
    const host = mountTopSheet()
    typeName(host, '  Hotel  ')
    act(() => box(host, 'dumbbell').click())
    act(() => box(host, 'barbell').click())
    act(() => box(host, 'barbell').click())   // ticked and unticked again
    expect(box(host, 'dumbbell').getAttribute('aria-checked')).toBe('true')
    expect(box(host, 'barbell').getAttribute('aria-checked')).toBe('false')
    act(() => button(host, 'Save').click())
    expect(S().equipProfiles).toHaveLength(1)
    expect(S().equipProfiles[0]).toMatchObject({ name: 'Hotel', equipment: ['dumbbell'], accV: 1 })
    expect(S().activeEquipId).toBe(S().equipProfiles[0].id)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('does not take the active profile from the one that already is', () => {
    setProfiles([home], 'home')
    act(() => equipmentProfileSheet(null))
    const host = mountTopSheet()
    typeName(host, 'Hotel')
    act(() => button(host, 'Save').click())
    expect(S().equipProfiles.map(p => p.name)).toEqual(['Home', 'Hotel'])
    expect(S().activeEquipId).toBe('home')
  })
})

describe('edit profile', () => {
  it('starts from the profile\'s name and ticks, and Save writes both back', () => {
    setProfiles([home, city], 'home')
    act(() => equipmentProfileSheet(home))
    const host = mountTopSheet()
    expect(host.querySelector('.g-bs-head h2').textContent).toBe('Edit profile')
    expect(host.querySelector('.g-tfield input').value).toBe('Home')
    expect(box(host, 'dumbbell').getAttribute('aria-checked')).toBe('true')
    expect(box(host, 'barbell').getAttribute('aria-checked')).toBe('false')
    typeName(host, 'Garage')
    act(() => box(host, 'barbell').click())
    act(() => box(host, 'dumbbell').click())
    act(() => button(host, 'Save').click())
    expect(S().equipProfiles[0]).toMatchObject({ id: 'home', name: 'Garage', equipment: ['bench', 'barbell'] })
    expect(S().equipProfiles[1].name).toBe('City Gym')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('shows the bench and the bar ticked on a profile saved before they were on the list', () => {
    const old = { id: 'old', name: 'Old', equipment: ['dumbbell'] }
    setProfiles([old], 'old')
    act(() => equipmentProfileSheet(old))
    const host = mountTopSheet()
    expect(box(host, 'bench').getAttribute('aria-checked')).toBe('true')
    expect(box(host, 'pull-up bar').getAttribute('aria-checked')).toBe('true')
  })
})

describe('Delete profile', () => {
  it('deletes at once with no confirm, closes the drawer, and the toast offers Undo', () => {
    setProfiles([home, city], 'home')
    act(() => equipmentProfileSheet(home))
    const host = mountTopSheet()
    act(() => button(host, 'Delete profile').click())
    expect(S().equipProfiles.map(p => p.id)).toEqual(['city'])
    expect(S().activeEquipId).toBe('city')
    expect(useUI.getState().sheets).toHaveLength(0)    // neither the drawer nor a confirm is up
    expect(useUI.getState().toastMsg).toBe('Deleted Home')
    expect(useUI.getState().toastAction?.label).toBe('Undo')
  })

  it('Undo puts the profile back where it was and makes it the active one again', () => {
    setProfiles([home, city], 'home')
    act(() => equipmentProfileSheet(home))
    const host = mountTopSheet()
    act(() => button(host, 'Delete profile').click())
    act(() => { useUI.getState().runToastAction() })
    expect(S().equipProfiles.map(p => p.id)).toEqual(['home', 'city'])
    expect(S().equipProfiles[0]).toMatchObject({ name: 'Home', equipment: ['dumbbell', 'bench'] })
    expect(S().activeEquipId).toBe('home')
  })
})
