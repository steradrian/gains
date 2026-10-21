import { nav, onSheetEntry } from '../../lib/nav.js'

// Leaving the Log food drawer for a page (the food editor): the drawer's own history entry is
// taken over by the page, so back from the page does not land on a drawer that is no longer there
// (the same rule as lib/nav.js closeThenNav, with the route's `state` carried along).
export function leaveTo(close, to, state) {
  const replace = onSheetEntry()
  close()
  nav(to, { ...(replace ? { replace: true } : null), ...(state ? { state } : null) })
}

export const newFoodPath = '/food/my-foods/foods/new'
export const foodEditPath = id => `/food/my-foods/foods/${id}`
