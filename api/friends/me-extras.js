/* Friends api m3: the parts of GET /me that depend on cheers, moments and challenges.
 *
 *   newCount          unread cheers plus moments of others newer than the viewer's `seen` marker
 *   newest            the group with the newest such moment: `{ group, at, moments: [{ id, kind,
 *                     names, title?, cheered }] }`, at most two moments; absent when nothing is new
 *   challengeInvites  open challenges the viewer has not joined (challenge-data.js)
 *
 * `seen` moves only with GET /cheers?seen=1 (cheers.js); reading /me never marks anything seen.
 * A viewer with Friends off gets nothing. Muted members' moments and cheers do not count, and a
 * disabled account is hidden through rules.js visibleMember, as everywhere. */
import { groupsOf, nameOf } from './rules.js';
import { groupMoments } from './group-view.js';
import { cheeredBy, unreadCheers } from './cheer-data.js';
import { challengeInvitesFor } from './challenge-data.js';

const stampOf = m => m.at || `${m.date}T00:00:00.000Z`;

export function meExtras(viewer, date, { data, active }) {
  if (data.people[viewer]?.on !== true) return { newCount: 0, challengeInvites: [] };
  const since = Date.parse(data.people[viewer].seen) || 0;
  const cheers = unreadCheers(data, active, viewer, since);
  let count = cheers.length;
  let best = null;
  if (date) {
    for (const group of groupsOf(data, viewer)) {
      const muted = new Set(data.people[viewer].mutes?.[group.id] || []);
      const fresh = groupMoments({ data, group, date, active })
        .filter(m => !m.who.includes(viewer) && !m.who.some(uid => muted.has(uid)) && Date.parse(stampOf(m)) > since);
      count += fresh.length;
      if (fresh.length && (!best || stampOf(fresh[0]) > best.at)) best = { group: group.id, at: stampOf(fresh[0]), list: fresh };
    }
  }
  const out = { newCount: count, challengeInvites: challengeInvitesFor({ data, active, viewer, date }) };
  if (best) {
    out.newest = {
      group: best.group,
      at: best.at,
      moments: best.list.slice(0, 2).map(m => ({
        id: m.id, kind: m.kind, names: m.who.map(uid => nameOf(active.get(uid))),
        ...(typeof m.title === 'string' && m.title ? { title: m.title } : {}),
        cheered: cheeredBy(data, viewer, best.group, 'moment', m.id)
      }))
    };
  }
  return out;
}
