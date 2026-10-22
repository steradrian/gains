/* Taking a deleted account out of Friends. Called by server.js inside deleteUserData (the admin's
 * delete and the scheduled self-deletion purge alike). Disabling an account does not call it:
 * disabling is reversible, and a disabled account is only hidden (rules.js isActiveUser).
 * Synchronous: friends.json is written before it returns, or it throws and nothing changed. */
import { friendsStore } from './store.js';
import { purgeFromData } from './rules.js';

export function purgeUser(uid, store = friendsStore, now = Date.now()) {
  store.mutate(d => purgeFromData(d, uid, now));
}
