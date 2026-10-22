/* friends.json: every group, membership, share switch, mute and invite, in one file under DATA.
 *
 * Loaded once, on first use, and held in memory. Every change goes through mutate(fn): fn runs
 * synchronously on the document and the file is written before mutate returns, with nothing
 * awaited in between, so two requests can never interleave a read-modify-write (the rule
 * PUT /api/data documents in server.js). A check and the change it guards belong in one fn: that
 * is what makes redeeming an invite single-use under concurrent requests.
 *
 * When fn throws, or the write fails, the document in memory goes back to what it was, so a
 * request that answered an error has changed nothing anywhere.
 *
 * Written only through durable.js atomicWrite, mode 0600. A missing file starts empty; so does an
 * unreadable one, which is first kept aside as friends.json.unreadable-<time> (as db.json is) so a
 * damaged file is never silently overwritten. Keys this version does not know are kept on rewrite.
 *
 * Shape:
 *   people:      { [uid]: { on, share?: { training, consistency, targets, bests },
 *                           mutes: { [groupId]: [uid] }, groupPrefs: { [groupId]: { muteNotifications } }, seen? } }
 *   groups:      { [id]: { id, name, goal: { kind, n? }, created, creator, members: [{ uid, joined }],
 *                          highWater: { [week]: { [uid]: n } }, removedMoments: [mid],
 *                          results?: { [week]: true | false | null }, lastWeek? } }   (results, lastWeek: Friends api m2, week.js)
 *   invites:     { [code]: { group, by, created, expiresAt, to?, usedBy?, usedAt?, revoked?, revokedAt? } }
 *   invitations: [{ code, group, from, to }]
 *   challenges:  {}   (api-m3)
 *   cheers:      []   (api-m3)
 * Ids only: a person's name is read from db.users at answer time and never copied here. */
import fs from 'node:fs';
import path from 'node:path';
import { atomicWrite } from '../durable.js';

const DATA = process.env.DATA_DIR || '/data';
export const FRIENDS_FILE = path.join(DATA, 'friends.json');

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export const emptyFriends = () => ({ people: {}, groups: {}, invites: {}, invitations: [], challenges: {}, cheers: [] });

/** The document with every known top-level key of the right type; unknown keys kept as they are. */
export function normalizeFriends(raw) {
  const d = isObj(raw) ? raw : {};
  return {
    ...d,
    people: isObj(d.people) ? d.people : {},
    groups: isObj(d.groups) ? d.groups : {},
    invites: isObj(d.invites) ? d.invites : {},
    invitations: Array.isArray(d.invitations) ? d.invitations : [],
    challenges: isObj(d.challenges) ? d.challenges : {},
    cheers: Array.isArray(d.cheers) ? d.cheers : []
  };
}

export function createFriendsStore(file = FRIENDS_FILE) {
  let doc = null;

  function load() {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); }
    catch (e) {
      if (e?.code !== 'ENOENT') console.error('friends.json cannot be read, starting empty:', e.message);
      return emptyFriends();
    }
    try {
      const parsed = JSON.parse(text);
      if (!isObj(parsed)) throw new Error('not an object');
      return normalizeFriends(parsed);
    } catch (err) {
      const aside = `${file}.unreadable-${Date.now()}`;
      try { fs.copyFileSync(file, aside); } catch { /* the original stays where it is until the next write */ }
      console.error(`friends.json cannot be read (${err.message}); kept a copy as ${path.basename(aside)}, starting empty`);
      return emptyFriends();
    }
  }

  const current = () => (doc ??= load());

  return {
    /** The document, for reading. Change it only inside mutate. */
    read: current,

    /** Runs fn(doc) and writes the file when fn changed anything; returns what fn returned. */
    mutate(fn) {
      const d = current();
      const before = JSON.stringify(d);
      let out;
      try { out = fn(d); }
      catch (e) { doc = JSON.parse(before); throw e; }
      const after = JSON.stringify(d);
      if (after === before) return out;
      try { atomicWrite(file, after, 0o600); }
      catch (e) { doc = JSON.parse(before); throw e; }
      return out;
    }
  };
}

/** The one store the server uses. */
export const friendsStore = createFriendsStore();
