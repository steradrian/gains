/** A loaded diary day with any food or water in it. */
export const dayHasLog = entry => !!(entry?.items?.length || entry?.water?.length)
