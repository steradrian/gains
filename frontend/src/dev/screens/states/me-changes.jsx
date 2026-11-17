import { useState } from 'react'
import { useUI } from '../../../store/useUI.js'
import ChangesRoute from '../../../views/me/changes/ChangesRoute.jsx'
import { registerScreens } from '../registry.js'
import { BOARD, COACH, OATS, OTHER_KINDS, ROUTINE, WEIGH_EDIT, memoryJournal } from './me-changes-fixture.js'

// The weigh-in first, so the first Restore is its.
const REFUSABLE = [WEIGH_EDIT, COACH, ROUTINE]

// Me > Recent changes (boards Me4Changes M4.0, Me4Restored M4.1, Me4Empty M4.2, and PR05Edges'
// "Restoring into a deleted place"): the real route over an in-memory journal, so a tap on Restore
// runs the real flow and nothing is written anywhere. The toast is the app's own, held open.

// The journal is made once per showing of a state: a restore flips a flag in it and the next state
// starts clean.
function Showing({ entries, results }) {
  const [journal] = useState(() => memoryJournal(entries, results))
  return <ChangesRoute journal={journal} />
}
const showing = (entries, results) => () => <Showing entries={entries} results={results} />

// The toast held open, as a finger resting on it would hold it.
const hold = async tt => {
  useUI.getState().pauseToast()
  await tt.wait(60)
}
const restoreFirst = async tt => {
  await tt.click('Restore')
  await tt.wait(120)
  await hold(tt)
}

registerScreens('Me: changes', [
  { id: 'M4.0', title: 'Recent changes', note: 'Five rows over three days (Today, Yesterday, the day before): a deleted food, a changed weigh-in, a Coach move with Undo, a deleted routine and a deleted set.',
    render: showing(BOARD), path: '/me/changes' },
  { id: 'M4.1', title: 'Restored', note: 'Restore tapped on the food: a Restored tag in its place, the toast names the day and meal and offers Undo for 8 s (held here).',
    render: showing(BOARD, { f1: { ok: true, where: { day: OATS.facts.day, meal: 'Breakfast' } } }), path: '/me/changes', play: restoreFirst },
  { id: 'M4.2', title: 'Nothing in 7 days', note: 'The calendar scene, centred on the stage; no button.',
    render: showing([]), path: '/me/changes' },
  { id: 'M4.1s', title: 'Restored into Snacks', note: 'Breakfast was deleted meanwhile: the food went back as Snacks and the toast says so.',
    render: showing(BOARD, { f1: { ok: true, where: { day: OATS.facts.day, meal: 'snacks' }, fellBack: 'snacks' } }), path: '/me/changes', play: restoreFirst },
  { id: 'M4.1x', title: 'Restore refused', note: 'The weigh-in day already has another reading: the toast gives the reason and the row keeps its button.',
    render: showing(REFUSABLE, { w1: { ok: false, reason: 'replaced' } }), path: '/me/changes', play: restoreFirst },
  { id: 'M4.1o', title: 'Restore offline', note: 'A food Restore with no connection: a retryable message and the row stays.',
    render: showing(BOARD, { f1: { ok: false, reason: 'error' } }), path: '/me/changes', play: restoreFirst },
  { id: 'M4.0k', title: 'Every other kind', note: 'A goal change, a deleted workout and a deleted weigh-in, with the food: the wording of each kind.',
    render: showing(OTHER_KINDS), path: '/me/changes' },
])
