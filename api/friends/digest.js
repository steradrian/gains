/* Friends api m3: the evening cheer digest. At 19:00 on each person's own clock, one push for the
 * cheers they have not seen: "Mara cheered you", "Mara and 2 others cheered you".
 *
 * The clock is the person's `S.reminder.tz` (written by the client), read through the server's
 * userNow. A person with no tz, or one userNow rejects (null), gets no push until a tz is known:
 * there is no fallback to UTC or to the server's zone, and no tz is stored here.
 *
 * Sent when all of these hold: Friends is on for them and the account is active and not awaiting
 * deletion; their local time is from 19:00 to before 22:00 (a restart in the evening still sends
 * it); they have a push subscription; there are unread cheers (cheer-data.js unreadCheers: newer
 * than `seen` and the last digest, not from someone they muted, not in a group whose notifications
 * they muted, senders visible); and no digest went out for that local date. Sending records
 * `digestSent` (the local date) and `digestAt` on the person before the push goes. A disabled
 * sender's cheers are not counted, and a disabled recipient is skipped; their records are kept.
 *
 * Driven from the existing reminder tick in server.js; every dependency comes in as an argument. */
import { friendsStore } from './store.js';
import { accountMaps, nameOf } from './rules.js';
import { atMs, readMark, unreadCheers } from './cheer-data.js';
import { cheerPush } from '../push-messages.js';

export const DIGEST_FROM = '19:00';
export const DIGEST_UNTIL = '22:00';

/**
 * `users` db.users, `stateOf(uid)` a person's synced state, `nowIn(tz)` userNow (`{ date, hhmm }` or
 * null), `hasSub(uid)`, `send(uid, payload)`. Returns the `[{ uid, payload }]` it sent.
 */
export function runDigest({ store = friendsStore, users, stateOf, nowIn, hasSub, send, deletionScheduled = () => false, now = Date.now() }) {
  const d = store.read();
  if (!d.cheers.length) return [];
  const { active } = accountMaps(users);
  const sent = [];
  for (const uid of new Set(d.cheers.map(c => c?.to))) {
    const person = d.people[uid];
    const user = active.get(uid);
    if (!user || person?.on !== true || deletionScheduled(user)) continue;
    let S;
    try { S = stateOf(uid); } catch { continue; }
    const tz = typeof S?.reminder?.tz === 'string' ? S.reminder.tz.trim() : '';
    if (!tz) continue;
    const local = nowIn(tz);
    if (!local || local.hhmm < DIGEST_FROM || local.hhmm >= DIGEST_UNTIL) continue;
    if (person.digestSent === local.date || !hasSub(uid)) continue;
    const unread = unreadCheers(d, active, uid, readMark(person)).filter(c => atMs(c) <= now);
    const names = [];
    for (const c of unread) {
      const name = nameOf(active.get(c.from));
      if (name && !names.includes(name)) names.push(name);
    }
    if (!names.length) continue;
    store.mutate(doc => {
      doc.people[uid].digestSent = local.date;
      doc.people[uid].digestAt = new Date(now).toISOString();
    });
    const payload = cheerPush(S.lang, names[0], names.length - 1);
    send(uid, payload);
    sent.push({ uid, payload });
  }
  return sent;
}
