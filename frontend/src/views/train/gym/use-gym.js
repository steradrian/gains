import { useEffect } from 'react'
import { dumbbellsOf } from '../../../lib/dumbbells.js'
import { inventoryFor, ownsPlates } from '../../../lib/plates.js'
import { t } from '../../../lib/i18n.js'
import { dumbbellInventorySheet, equipmentProfileSheet, plateInventorySheet } from '../../../sheets.jsx'
import { useStore } from '../../../store/useStore.js'

/** The profile chips' "+ New": not a profile, so it never holds the lit chip. */
export const NEW_PROFILE = '+new'

// A Settings search hit lands on /me/equipment with the row's English title (views/settings-pages.js);
// each lands on the part of this page that holds it.
const ANCHORS = {
  Plates: 'gym-plates',
  Dumbbells: 'gym-bells',
  'Filter by equipment': 'gym-filter',
  'Active profile': 'gym-profiles',
  'Add equipment profile': 'gym-profiles'
}
const FLASH_MS = 1900

/**
 * What Gym setup (T12.0) shows, as data: the profiles and the active one, the unit, the plates and
 * dumbbells as the inventories hold them (one set of each for every profile), the equipment filter,
 * and what a tap does. Plates and dumbbells are global, not per profile (owner question 8).
 *
 * `find` is the row a Settings search asked for: it is scrolled to and flashed once.
 */
export function useGym(find) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const profiles = S.equipProfiles || []

  useEffect(() => {
    const el = find && ANCHORS[find] ? document.getElementById(ANCHORS[find]) : null
    if (!el) return undefined
    el.classList.add('tcp-flash')
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' })
    const timer = setTimeout(() => el.classList.remove('tcp-flash'), FLASH_MS)
    return () => { clearTimeout(timer); el.classList.remove('tcp-flash') }
  }, [find])

  return {
    profiles,
    active: profiles.find(p => p.id === S.activeEquipId) || null,
    unit: S.unit === 'lb' ? 'lb' : 'kg',
    plates: inventoryFor(S),
    ownPlates: ownsPlates(S),
    bells: dumbbellsOf(S),
    filterOn: !!S.equipFilterOn,
    chips: [...profiles.map(p => ({ value: p.id, label: p.name })), { value: NEW_PROFILE, label: '+ ' + t('New') }],
    pick: id => {
      if (id === NEW_PROFILE) { equipmentProfileSheet(null); return }
      update(s => { s.activeEquipId = id })
    },
    setFilter: on => update(s => { s.equipFilterOn = on }),
    editProfile: profile => equipmentProfileSheet(profile),
    openPlates: () => plateInventorySheet(),
    openBells: () => dumbbellInventorySheet()
  }
}
