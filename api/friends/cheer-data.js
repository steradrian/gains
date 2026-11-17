/* Friends api m3: reading cheers. A cheer is `{ from, to, group, kind, ref, week, at }`: one record
 * per recipient, so "Cheer everyone" and a Trained together moment make several, all with the same
 * (from, kind, ref). `week` is the Monday of the week it was given (the cheerer's date when the
 * client sent one), which is what "this week's cheers" filters on.
 *
 * Who shows: a cheer is live while its group exists and both people are still in it, and while the
 * sender is someone the recipient sees (rules.js visibleMember: an active account with Friends on).
 * A disabled sender is hidden in every count and list without a record being touched, so enabling
 * the account brings the cheers back.
 *
 * Unread, for the evening push and `newCount`: live, newer than the person's `seen` marker (and
 * their last digest), and not from someone they muted in that group nor in a group they muted
 * notifications for. Such a cheer is still stored and still listed, only silent. */
import { isMember, visibleMember } from './rules.js';
import { refOf } from './stats.js';

export const CHEER_KINDS = ['moment', 'week', 'challenge'];
export const CHEER_KEEP_MS = 14 * 86400000;
export const REF_MAX = 400;

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export const cheerId = c => 'c_' + refOf(`${c.from}|${c.to}|${c.group}|${c.kind}|${c.ref}`);
export const atMs = c => Date.parse(c.at) || 0;
export const sameCheer = (c, from, gid, kind, ref) => c.from === from && c.group === gid && c.kind === kind && c.ref === ref;

/** The live cheers `viewer` received, newest first. */
export function liveCheersTo(data, active, viewer) {
  return data.cheers
    .filter(c => isObj(c) && c.to === viewer && typeof c.at === 'string'
      && isMember(data.groups[c.group], viewer) && isMember(data.groups[c.group], c.from)
      && visibleMember(data, c.from, viewer, active))
    .sort((a, b) => atMs(b) - atMs(a) || (a.ref < b.ref ? -1 : 1));
}

/** Unread cheers (above) newer than `since` (ms). */
export function unreadCheers(data, active, viewer, since) {
  const person = data.people[viewer];
  return liveCheersTo(data, active, viewer).filter(c => {
    if (atMs(c) <= since) return false;
    if (person?.groupPrefs?.[c.group]?.muteNotifications === true) return false;
    const muted = person?.mutes?.[c.group];
    return !(Array.isArray(muted) && muted.includes(c.from));
  });
}

/** The marker unread is measured from: the later of `seen` and the last digest. */
export function readMark(person) {
  return Math.max(Date.parse(person?.seen) || 0, Date.parse(person?.digestAt) || 0);
}

/** Whether `viewer` cheered this item in group `gid`. */
export const cheeredBy = (data, viewer, gid, kind, ref) => data.cheers.some(c => isObj(c) && sameCheer(c, viewer, gid, kind, ref));

/** How many cheers `viewer` got in `gid` in the week starting `week`. */
export function cheersInWeek(data, active, viewer, gid, week) {
  return liveCheersTo(data, active, viewer).filter(c => c.group === gid && c.week === week).length;
}
