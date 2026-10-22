/* Taking a deleted or disabled account out of Friends. Called by server.js inside deleteUserData
 * (the admin's delete and the scheduled self-deletion purge alike) and by the admin's disable.
 * Synchronous: friends.json is written before it returns, or it throws and nothing changed. */
import { friendsStore } from './store.js';
import { purgeFromData } from './rules.js';

export function purgeUser(uid, store = friendsStore, now = Date.now()) {
  store.mutate(d => purgeFromData(d, uid, now));
}
