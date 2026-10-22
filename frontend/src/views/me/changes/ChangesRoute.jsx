import { back } from '../../../lib/use-tab-nav.js'
import ChangesScreen from './ChangesScreen.jsx'
import { REAL_JOURNAL, useChanges } from './use-changes.js'

// /me/changes (Me4Changes): the journal's last 7 days drawn by ChangesScreen. Back goes down the
// Me tab's stack, or on a cold entry to the Me root (lib/tab-route.js parentOf). `journal` is for
// the screens gallery's in-memory one.
export default function ChangesRoute({ journal = REAL_JOURNAL }) {
  const { days, restoredIds, alreadyIds, busyIds, unit, restore } = useChanges(journal)
  return <ChangesScreen days={days} restoredIds={restoredIds} alreadyIds={alreadyIds} busyIds={busyIds} unit={unit} onRestore={restore} onBack={() => back()} />
}
