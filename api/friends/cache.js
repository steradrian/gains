/* Friends api m2: each person's projection (stats.js memberWeek) for the last minute, by person,
 * day and share switches, so a group of twelve opened by all twelve reads each state file once.
 *
 * The share switches are part of the key, so a projection is never served across a change of
 * them; PUT /api/friends/me drops the person's entries anyway, and PUT /api/data drops them on
 * every write of that person's state (server.js calls invalidateMember). Any other writer of a
 * state file is seen within MEMO_MS.
 *
 * The state is read here and handed to the projection; only the projection is kept, never the
 * document. */
import fs from 'node:fs';
import path from 'node:path';
import { SHARE_KEYS } from './rules.js';
import { memberWeek } from './stats.js';
import { challengeFacts } from './challenge-facts.js';

const DATA = process.env.DATA_DIR || '/data';
export const MEMO_MS = 60000;
export const MEMO_MAX = 512;

const memo = new Map();   // key -> { at, uid, value }; insertion order is age order

/** A person's stored state, as server.js names its file; null when there is none or it cannot be read. */
export function readMemberState(uid) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, 'state-' + String(uid).replace(/[^a-zA-Z0-9_-]/g, '') + '.json'), 'utf8')); }
  catch { return null; }
}

/** memberWeek of `uid`'s stored state on `date` under `share`, at most MEMO_MS old. */
export function memberProjection(uid, share, date, now = Date.now()) {
  const key = `${uid}|${date}|${SHARE_KEYS.map(k => (share?.[k] === true ? 1 : 0)).join('')}`;
  const hit = memo.get(key);
  if (hit && now - hit.at >= 0 && now - hit.at < MEMO_MS) return hit.value;
  let value;
  // One person's damaged state is that person's problem: they show as nothing, the group still opens.
  try { value = memberWeek(readMemberState(uid), share, date); }
  catch (e) {
    console.error('friends projection failed for', uid, e.message);
    value = memberWeek(null, share, date);
  }
  memo.delete(key);
  memo.set(key, { at: now, uid, value });
  while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value);
  return value;
}

/** Forgets every projection of `uid`: their state or their switches changed. */
export function invalidateMember(uid) {
  for (const [k, v] of memo) if (v.uid === uid) memo.delete(k);
  for (const [k, v] of factsMemo) if (v.uid === uid) factsMemo.delete(k);
}

/* Friends api m3: what a challenge counts for `uid` between two dates (challenge-facts.js), kept
 * for MEMO_MS like a projection and dropped by invalidateMember. */
const factsMemo = new Map();

export function memberFacts(uid, from, to, now = Date.now()) {
  const key = `${uid}|${from}|${to}`;
  const hit = factsMemo.get(key);
  if (hit && now - hit.at >= 0 && now - hit.at < MEMO_MS) return hit.value;
  let value;
  try { value = challengeFacts(readMemberState(uid), from, to); }
  catch (e) {
    console.error('friends challenge facts failed for', uid, e.message);
    value = challengeFacts(null, from, to);
  }
  factsMemo.delete(key);
  factsMemo.set(key, { at: now, uid, value });
  while (factsMemo.size > MEMO_MAX) factsMemo.delete(factsMemo.keys().next().value);
  return value;
}
