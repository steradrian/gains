import { useState } from 'react'
import { ACC_V, ALL_EQUIPMENT, newProfile, profileEquipment } from '../../../lib/equipment.js'
import { deleteProfileWithUndo } from '../../../lib/equipment-delete.js'
import { t } from '../../../lib/i18n.js'
import { useStore } from '../../../store/useStore.js'
import { useUI } from '../../../store/useUI.js'
import BottomSheet from '../../../ds/BottomSheet.jsx'
import Button from '../../../ds/Button.jsx'
import DetailRow from '../../../ds/DetailRow.jsx'
import TextField from '../../../ds/TextField.jsx'
import '../coach-pages.css'
import EquipmentChecklist from './EquipmentChecklist.jsx'

const NAME_MAX = 40

// Create or edit one equipment profile ("Home", "Gym", ...) in a full drawer (T12.1): a name and a
// checklist of what is there. Editing adds Delete profile, which deletes at once and offers Undo in
// the toast instead of asking first; the toast puts the profile back, and makes it the active one
// again if it was and nothing else has been picked since. Plates and dumbbells are not here: they
// are the one inventory every profile shares, edited from Gym setup.
export default function ProfileDrawer({ profile, close }) {
  const [name, setName] = useState(profile?.name || '')
  const [checked, setChecked] = useState(() => new Set(profile ? profileEquipment(profile) : []))
  const toggle = k => setChecked(s => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const trimmed = name.trim()

  const save = () => {
    if (!trimmed) return
    useStore.getState().update(s => {
      s.equipProfiles = s.equipProfiles || []
      const equipment = [...checked]
      if (profile) {
        const p = s.equipProfiles.find(x => x.id === profile.id)
        if (p) { p.name = trimmed; p.equipment = equipment; p.accV = ACC_V }
      } else {
        const p = newProfile(trimmed)
        p.equipment = equipment
        s.equipProfiles.push(p)
        if (!s.activeEquipId) s.activeEquipId = p.id
      }
    })
    close()
  }

  const remove = () => {
    const res = deleteProfileWithUndo(profile.id)
    close()
    if (res) useUI.getState().toast(t('Deleted {0}', res.profile.name), { action: t('Undo'), onAction: res.undo })
  }

  return (
    <BottomSheet type="full" title={profile ? t('Edit profile') : t('New equipment profile')}
      footer={<Button block disabled={!trimmed} onClick={save}>{t('Save')}</Button>}>
      <p className="tcp-dnote">{t('Name it after where you train (like "Home" or "Gym"), then tick what you’ve got there.')}</p>
      <TextField label={t('Profile name')} value={name} onChange={setName} inputProps={{ maxLength: NAME_MAX }} />
      <EquipmentChecklist label={t('Equipment')} items={ALL_EQUIPMENT} checked={checked} onToggle={toggle} />
      <p className="tcp-dnote">{t('Body-weight exercises are always available, unless they need a pull-up bar or a bench.')}</p>
      {profile && <DetailRow danger title={t('Delete profile')} onClick={remove} />}
    </BottomSheet>
  )
}
