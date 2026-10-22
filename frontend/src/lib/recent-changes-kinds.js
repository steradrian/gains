// The one registry of journal kinds: importing a kind's module registers its restorer
// (lib/recent-changes.js registerRestorer), so whatever shows or restores the journal imports
// this file. Each milestone adds its import lines under its own comment.
import { setStateReader } from './recent-changes.js'
import { useStore } from '../store/useStore.js'

setStateReader(() => useStore.getState().S)

// Me changes M1
import './me/routine-changes.js'
import './me/workout-changes.js'
import './me/set-changes.js'
