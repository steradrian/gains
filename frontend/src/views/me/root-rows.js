// The "You" group on the Me root (board M1.0): Body, Recent changes, Invite a friend, and then the
// rows other slices hand in through ME_ROW_SLOTS. No JSX; MeScreen draws what comes out.
import { t } from '../../lib/i18n.js'
import { mePath } from '../../lib/tab-route.js'

/**
 * Rows other slices add, each `{ id, title, sub, icon, to, tag, visible(ctx) }`; they render after
 * the core rows, in order, and only where `visible(ctx)` is true (no `visible` shows it). Friends
 * puts its Groups row in `you` with `tag: 'New'` (views/friends/me-rows.js), and only when Friends
 * is on: no row, and no empty Groups page, when it is off.
 */
export const ME_ROW_SLOTS = { you: [] }

const bodySub = ctx => (ctx.bodyLogged ? t('Weigh-ins, measurements, photos') : t('Nothing logged yet'))
const changesSub = ctx => (ctx.changeCount > 0 ? t('{0} in the last 7 days', ctx.changeCount) : t('Nothing in the last 7 days'))

// "2 joined · 1 waiting": only for an admin whose invites have loaded and who has sent any; else
// what the link is.
function inviteSub(ctx) {
  const { joined = 0, waiting = 0 } = ctx.invites || {}
  const parts = [joined > 0 && t('{0} joined', joined), waiting > 0 && t('{0} waiting', waiting)].filter(Boolean)
  return parts.length ? parts.join(' · ') : t('A link that works once')
}

/**
 * The rows of the You group, as `{ id, title, sub, icon, to, tag? }`.
 * ctx: `{ bodyLogged, changeCount, invites: { joined, waiting } | null, canInvite }` plus whatever
 * a slot row's `visible` reads.
 */
export function meRows(ctx, slots = ME_ROW_SLOTS) {
  const own = [
    { id: 'body', icon: 'person', title: t('Body'), sub: bodySub(ctx), to: mePath('body') },
    { id: 'changes', icon: 'history', title: t('Recent changes'), sub: changesSub(ctx), to: mePath('changes') },
    ...(ctx.canInvite ? [{ id: 'invite', icon: 'envelope', title: t('Invite a friend'), sub: inviteSub(ctx), to: mePath('invite') }] : []),
  ]
  const extra = (slots.you || []).filter(row => !row.visible || row.visible(ctx))
  return [...own, ...extra.map(({ visible, ...row }) => row)]
}
