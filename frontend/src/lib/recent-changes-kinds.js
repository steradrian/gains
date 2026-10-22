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

// Me changes M2
import './me/food-changes.js'
import './me/coach-changes.js'
// Me goal M1
import './me/goal-changes.js'
// Me body M1
import './me/weigh-in-changes.js'
// Me photos M3
import './me/photo-changes.js'
// Me fix measure
import './me/measure-changes.js'
