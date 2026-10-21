import { nav, onSheetEntry } from '../lib/nav.js'

// Ready-made plans are a page now (views/train/plans, /train/plans), not a sheet. The opener keeps
// its name so every caller (Train's rows, the empty states, Settings' search) stays as it is. Called
// from a drawer that has just closed, it takes that drawer's history entry instead of stacking on
// it, as lib/nav.js closeThenNav does.
export const starterPlanSheet = () => nav('/train/plans', onSheetEntry() ? { replace: true } : undefined)
