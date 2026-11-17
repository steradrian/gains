import { useStore } from '../../store/useStore.js'
import { nutritionAvailable } from './api.js'
import { foodTracked } from './food-tracked.js'

/**
 * Whether Food shows at all: the hub is reachable (web app, signed in) and the person has not
 * switched Food off in Settings > Features. The one answer for every surface that offers or reads
 * food (the + sheet, scan, Progress, Trends, search, notifications, Today). `nutritionAvailable`
 * alone is only the first half: the hub's reach, which sync and sign-in flows still need whatever
 * the switch says. Off deletes nothing; on again brings back everything.
 */
export const foodOn = (user, S) => nutritionAvailable(user) && foodTracked(S)

export const useFoodOn = () => useStore(s => foodOn(s.user, s.S))

/** The same, read once (an effect or a handler, not a render). */
export const foodOnNow = () => foodOn(useStore.getState().user, useStore.getState().S)
