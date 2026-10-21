import { closeThen, nav } from '../../lib/nav.js'

// Leaving the Log food drawer for a page (the food editor): the drawer, with any sub-panels it
// holds, goes first and the page takes its history entry (lib/nav.js closeThen), with the route's
// `state` carried along.
export const leaveTo = (close, to, state) =>
  closeThen(close, replace => nav(to, { ...(replace ? { replace: true } : null), ...(state ? { state } : null) }))

export const newFoodPath = '/food/my-foods/foods/new'
export const foodEditPath = id => `/food/my-foods/foods/${id}`
