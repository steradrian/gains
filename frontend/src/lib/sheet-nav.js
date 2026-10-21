// The two ways out of a drawer that are not one of its own buttons, on the UI store's `ui` (its
// `sheets` and `closeSheet`). A drawer holds sub-panels (store/useUI.js openSheet), so "out" has
// two sizes.

// The backdrop, a swipe down: the whole drawer goes, and each panel's onDismiss runs, the top one
// first, then the drawer's own. A locked drawer stays. Returns whether it closed.
export function dismissSheet(ui, id) {
  const sheet = ui.sheets.find(s => s.id === id)
  if (!sheet || sheet.locked) return false
  ui.closeSheet(id)
  for (const p of [...(sheet.panels || [])].reverse()) p.onDismiss?.()
  sheet.onDismiss?.()
  return true
}

// Back (the chevron, Escape, the browser's or Android's back): one step. The drawer's top panel
// slides out, or with none the drawer is dismissed. A locked panel (or a locked drawer with no
// panel) stays. Returns whether anything closed.
export function backSheet(ui, id) {
  const sheet = ui.sheets.find(s => s.id === id)
  const top = sheet?.panels?.at(-1)
  if (!top) return dismissSheet(ui, id)
  if (top.locked) return false
  ui.closeSheet(top.id)
  top.onDismiss?.()
  return true
}

// What is on screen on top: the top drawer's top sub-panel, or the drawer itself. Both have `id`,
// `render`, `locked` and `onDismiss`.
export const topSurface = sheets => {
  const host = sheets.at(-1)
  return host?.panels?.at(-1) || host
}

// History entries a stack of sheets holds: one for each drawer and one for each of its panels.
export const sheetEntryCount = sheets => sheets.reduce((n, s) => n + 1 + (s.panels?.length || 0), 0)
