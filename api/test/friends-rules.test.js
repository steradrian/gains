/* The Friends rules without a server (friends/rules.js, friends/invites.js): names, goals, share
   switches, join order, creator succession, the last member out, the purge of an account, the
   Monday week, and the group invite codes: shape, single use, revoked, and expiry at exactly seven
   days. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_CAP, cleanText, groupName, parseGoal, parseShare, shareOf, isMember, memberOrder, newGroup,
  addMember, dropMember, deleteGroup, purgeFromData, groupsOf, isDate, weekOf, initialOf, mentions
} from '../friends/rules.js';
import {
  FRIEND_INVITE_TTL_MS, CODE_ALPHABET, LIVE_CODES_PER_MEMBER, codeOf, newCode, newGroupInvite, codeStatus,
  lookupInvite, redeem, tidyInvites, hasOpenInvitation
} from '../friends/invites.js';
import { emptyFriends } from '../friends/store.js';
import { summaryNumbers } from '../friends/stats-hook.js';

const T0 = Date.parse('2026-10-19T09:00:00.000Z');
const DAY = 86400000;

/** A document with group g1 of `uids` in that join order, the first one its creator. */
function withGroup(uids, extra = {}) {
  const d = emptyFriends();
  const g = newGroup({ id: 'g1', name: 'Iron Sunday', goal: { kind: 'planned' }, creator: uids[0], now: T0 });
  uids.slice(1).forEach((uid, i) => addMember(g, uid, T0 + (i + 1) * 1000));
  d.groups.g1 = { ...g, ...extra };
  for (const uid of uids) d.people[uid] = { on: true, share: { training: true }, mutes: {}, groupPrefs: {} };
  return d;
}

test('a group name is cleaned: trimmed, whitespace folded, control and invisible characters out, 40 at most', () => {
  assert.equal(groupName('  Iron   Sunday \n'), 'Iron Sunday');
  assert.equal(groupName('Iron\u0000Sunday\u0007'), 'Iron Sunday');
  assert.equal(groupName('Iron​Sun⁦day'), 'IronSunday');
  assert.equal(groupName('a‍b'), 'a‍b', 'a joiner is kept');
  assert.equal(groupName('x'.repeat(50)), 'x'.repeat(40));
  assert.equal(Array.from(groupName('💪'.repeat(41))).length, 40, 'cut by character, never inside one');
  for (const bad of ['', '   ', '\u0000\u0001', '​', null, 42, {}, ['Iron']]) assert.equal(groupName(bad), null, JSON.stringify(bad));
  assert.equal(cleanText({ toString: () => 'x' }), '');
});

test('a goal is planned, targets, or a number from 1 to 200, and nothing else', () => {
  assert.deepEqual(parseGoal({ kind: 'planned' }), { kind: 'planned' });
  assert.deepEqual(parseGoal({ kind: 'targets', n: null }), { kind: 'targets' });
  assert.deepEqual(parseGoal({ kind: 'number', n: 1 }), { kind: 'number', n: 1 });
  assert.deepEqual(parseGoal({ kind: 'number', n: 200 }), { kind: 'number', n: 200 });
  for (const bad of [
    { kind: 'number', n: 0 }, { kind: 'number', n: 201 }, { kind: 'number', n: 2.5 }, { kind: 'number', n: '5' }, { kind: 'number' },
    { kind: 'planned', n: 3 }, { kind: 'weekly' }, { kind: 'planned', extra: 1 }, {}, null, 'planned', [{ kind: 'planned' }]
  ]) assert.equal(parseGoal(bad), null, JSON.stringify(bad));
});

test('share switches merge over what is stored, take only the four known keys, booleans only', () => {
  assert.deepEqual(parseShare({ training: true }, undefined), { training: true, consistency: false, targets: false, bests: false });
  assert.deepEqual(parseShare({ bests: true }, { training: true, consistency: true }), { training: true, consistency: true, targets: false, bests: true });
  for (const bad of [{ weight: true }, { training: 'yes' }, { training: 1 }, null, [], 'all']) assert.equal(parseShare(bad, {}), null, JSON.stringify(bad));
  assert.deepEqual(shareOf(undefined), { training: false, consistency: false, targets: false, bests: false });
  assert.deepEqual(shareOf({ share: { training: 'yes', bests: true } }), { training: false, consistency: false, targets: false, bests: true });
});

test('join order is the order people joined; a new member goes last', () => {
  const d = withGroup(['u1', 'u2', 'u3']);
  assert.deepEqual(memberOrder(d.groups.g1), ['u1', 'u2', 'u3']);
  addMember(d.groups.g1, 'u0', T0 + 9000);
  assert.deepEqual(memberOrder(d.groups.g1), ['u1', 'u2', 'u3', 'u0']);
  assert.ok(isMember(d.groups.g1, 'u0'));
  assert.ok(!isMember(d.groups.g1, 'u9'));
  assert.ok(!isMember({ members: 'u1' }, 'u1'), 'a damaged member list holds nobody');
  assert.equal(GROUP_CAP, 12);
});

test('the creator leaving passes the group to the longest-standing member, never to a newer one', () => {
  const d = withGroup(['u1', 'u2', 'u3']);
  assert.deepEqual(dropMember(d, 'g1', 'u1', T0), { removed: true, deleted: false });
  assert.equal(d.groups.g1.creator, 'u2');
  assert.deepEqual(memberOrder(d.groups.g1), ['u2', 'u3']);
  dropMember(d, 'g1', 'u3', T0);
  assert.equal(d.groups.g1.creator, 'u2', 'a member leaving changes nothing about the creator');
});

test('the last member out deletes the group with its invites, invitations, mutes and prefs', () => {
  const d = withGroup(['u1', 'u2']);
  d.invites.AAAAAAAAAA = newGroupInvite({ group: 'g1', by: 'u1', now: T0 });
  d.invites.BBBBBBBBBB = newGroupInvite({ group: 'g1', by: 'u2', to: 'u3', now: T0 });
  d.invitations.push({ code: 'BBBBBBBBBB', group: 'g1', from: 'u2', to: 'u3' });
  d.people.u3 = { on: true, mutes: { g1: ['u1'] }, groupPrefs: { g1: { muteNotifications: true } } };
  dropMember(d, 'g1', 'u1', T0);
  assert.deepEqual(dropMember(d, 'g1', 'u2', T0), { removed: true, deleted: true });
  assert.equal(d.groups.g1, undefined);
  assert.deepEqual(d.invites, {});
  assert.deepEqual(d.invitations, []);
  assert.deepEqual(d.people.u3.mutes, {});
  assert.deepEqual(d.people.u3.groupPrefs, {});
  assert.ok(!JSON.stringify(d).includes('g1'));
});

test('leaving takes the member out of everything hanging off that membership, and only that group', () => {
  const d = withGroup(['u1', 'u2', 'u3'], {
    highWater: { '2026-10-19': { u1: 2, u2: 3 } },
    removedMoments: ['together:2026-10-20:u1,u2:r1', 'together:2026-10-20:u10,u3:r1']
  });
  d.groups.g2 = newGroup({ id: 'g2', name: 'Other', goal: { kind: 'planned' }, creator: 'u2', now: T0 });
  d.people.u2.mutes = { g1: ['u3'], g2: ['u9'] };
  d.people.u2.groupPrefs = { g1: { muteNotifications: true }, g2: { muteNotifications: false } };
  d.people.u1.mutes = { g1: ['u2'] };
  d.people.u3.mutes = { g1: ['u2', 'u1'] };
  d.invites.AAAAAAAAAA = newGroupInvite({ group: 'g1', by: 'u2', now: T0 });
  d.invites.CCCCCCCCCC = newGroupInvite({ group: 'g2', by: 'u2', now: T0 });
  d.invitations.push({ code: 'AAAAAAAAAA', group: 'g1', from: 'u2', to: 'u7' });
  dropMember(d, 'g1', 'u2', T0 + DAY);
  assert.deepEqual(memberOrder(d.groups.g1), ['u1', 'u3']);
  assert.deepEqual(d.groups.g1.highWater, { '2026-10-19': { u1: 2 } });
  assert.deepEqual(d.groups.g1.removedMoments, ['together:2026-10-20:u10,u3:r1'], 'only the moments that name u2');
  assert.deepEqual(d.people.u2.mutes, { g2: ['u9'] });
  assert.deepEqual(d.people.u2.groupPrefs, { g2: { muteNotifications: false } });
  assert.deepEqual(d.people.u1.mutes, {}, 'a mute on the leaver goes');
  assert.deepEqual(d.people.u3.mutes, { g1: ['u1'] });
  assert.equal(codeStatus(d.invites.AAAAAAAAAA, T0 + DAY), 'revoked', 'their link stops working');
  assert.equal(codeStatus(d.invites.CCCCCCCCCC, T0 + DAY), 'valid', 'another group is untouched');
  assert.deepEqual(d.invitations, []);
  assert.deepEqual(dropMember(d, 'g1', 'u2', T0), { removed: false, deleted: false }, 'not a member any more');
});

test('mentions matches whole ids only', () => {
  assert.ok(mentions('together:2026-10-20:u1,u2:r1', 'u2'));
  assert.ok(!mentions('together:2026-10-20:u10,u2:r1', 'u1'));
  assert.ok(!mentions(null, 'u1'));
});

test('purging an account leaves no trace of its id anywhere in the document', () => {
  const d = withGroup(['gone', 'u2', 'u3'], { highWater: { '2026-10-19': { gone: 4 } }, removedMoments: ['workout:2026-10-20:gone:w1'] });
  d.groups.g2 = newGroup({ id: 'g2', name: 'Solo', goal: { kind: 'planned' }, creator: 'gone', now: T0 });
  d.people.u2.mutes = { g1: ['gone'] };
  d.invites.AAAAAAAAAA = newGroupInvite({ group: 'g1', by: 'gone', now: T0 });
  d.invites.BBBBBBBBBB = newGroupInvite({ group: 'g1', by: 'u2', to: 'gone', now: T0 });
  d.invites.CCCCCCCCCC = newGroupInvite({ group: 'g1', by: 'u2', now: T0 });
  redeem(d.invites.CCCCCCCCCC, 'gone', T0);
  d.invitations.push({ code: 'BBBBBBBBBB', group: 'g1', from: 'u2', to: 'gone' });
  d.cheers = [{ from: 'gone', to: 'u2' }, { from: 'u3', to: 'gone' }, { from: 'u2', to: 'u3' }];
  purgeFromData(d, 'gone', T0);
  assert.ok(!JSON.stringify(d).includes('gone'), JSON.stringify(d));
  assert.equal(d.groups.g1.creator, 'u2', 'the longest-standing member takes over');
  assert.equal(d.groups.g2, undefined, 'a group left empty is deleted');
  assert.equal(codeStatus(d.invites.AAAAAAAAAA, T0), 'revoked');
  assert.equal(d.invites.BBBBBBBBBB, undefined);
  assert.equal(codeStatus(d.invites.CCCCCCCCCC, T0), 'used', 'still used, without saying by whom');
  assert.deepEqual(d.cheers, [{ from: 'u2', to: 'u3' }]);
});

test('deleteGroup removes the group from every person', () => {
  const d = withGroup(['u1']);
  d.people.u1.mutes = { g1: ['u2'] };
  deleteGroup(d, 'g1');
  assert.deepEqual(d.groups, {});
  assert.deepEqual(d.people.u1.mutes, {});
});

test('groupsOf lists a person’s groups in the order they joined them', () => {
  const d = withGroup(['u1', 'u2']);
  d.groups.g0 = newGroup({ id: 'g0', name: 'Earlier', goal: { kind: 'planned' }, creator: 'u2', now: T0 - DAY });
  assert.deepEqual(groupsOf(d, 'u2').map(g => g.id), ['g0', 'g1']);
  assert.deepEqual(groupsOf(d, 'u1').map(g => g.id), ['g1']);
  assert.deepEqual(groupsOf(d, 'u9'), []);
});

test('the week is Monday to Sunday, keyed by its Monday, on the date string alone', () => {
  assert.equal(weekOf('2026-10-19'), '2026-10-19', 'a Monday');
  assert.equal(weekOf('2026-10-25'), '2026-10-19', 'its Sunday');
  assert.equal(weekOf('2026-10-26'), '2026-10-26', 'the next Monday');
  assert.equal(weekOf('2026-11-01'), '2026-10-26', 'across a month');
  assert.equal(weekOf('2027-01-01'), '2026-12-28', 'across a year');
  assert.equal(weekOf('2026-02-30'), null);
  for (const bad of ['2026-2-3', '20261019', '2026-10-19T00:00', '1999-12-31', null, 20261019]) assert.equal(isDate(bad), false, String(bad));
  assert.ok(isDate('2028-02-29'));
  assert.ok(!isDate('2026-02-29'));
});

test('an initial is the first letter of the name, upper-cased', () => {
  assert.equal(initialOf('mara'), 'M');
  assert.equal(initialOf(' Ioana'), 'I');
  assert.equal(initialOf('Łukasz'), 'Ł');
  assert.equal(initialOf(''), '');
});

test('a code is 10 characters from the unambiguous alphabet, typed in any case', () => {
  assert.ok(!/[01IOL]/.test(CODE_ALPHABET));
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const c = newCode(x => seen.has(x));
    assert.match(c, /^[A-HJKMNP-Z2-9]{10}$/);
    assert.ok(!seen.has(c));
    seen.add(c);
  }
  let calls = 0;
  const c = newCode(() => ++calls < 3);
  assert.equal(calls, 3, 'a taken code is drawn again');
  assert.equal(codeOf(c.toLowerCase()), c);
  for (const bad of ['', 'ABC', 'ABCDEFGHJKM', 'ABCDEFGHJ0', 'ABCDEFGHJ/', null, 1234567890]) assert.equal(codeOf(bad), null, String(bad));
});

test('an invite works for seven days: valid a millisecond before, expired at exactly seven days', () => {
  const inv = newGroupInvite({ group: 'g1', by: 'u1', now: T0 });
  assert.equal(Date.parse(inv.expiresAt) - Date.parse(inv.created), 7 * DAY);
  assert.equal(FRIEND_INVITE_TTL_MS, 7 * DAY);
  assert.equal(codeStatus(inv, T0 + 7 * DAY - 1), 'valid');
  assert.equal(codeStatus(inv, T0 + 7 * DAY), 'expired');
  assert.equal(codeStatus({ ...inv, expiresAt: 'soon' }, T0), 'expired', 'an unreadable expiry is expired');
});

test('an invite works once; used outranks revoked, revoked outranks expired', () => {
  const inv = newGroupInvite({ group: 'g1', by: 'u1', now: T0 });
  redeem(inv, 'u2', T0 + 1);
  assert.equal(codeStatus(inv, T0 + 2), 'used');
  assert.equal(codeStatus({ ...inv, revoked: true }, T0 + 8 * DAY), 'used');
  assert.equal(codeStatus({ ...newGroupInvite({ group: 'g1', by: 'u1', now: T0 }), revoked: true }, T0 + 8 * DAY), 'revoked');
});

test('lookupInvite: member first, a code bound to someone else does not exist, nor one whose group is gone', () => {
  const d = withGroup(['u1', 'u2']);
  d.invites.AAAAAAAAAA = newGroupInvite({ group: 'g1', by: 'u1', now: T0 });
  d.invites.BBBBBBBBBB = newGroupInvite({ group: 'g1', by: 'u1', to: 'u3', now: T0 });
  d.invites.CCCCCCCCCC = newGroupInvite({ group: 'nope', by: 'u1', now: T0 });
  assert.equal(lookupInvite(d, 'AAAAAAAAAA', 'u3', T0).status, 'valid');
  assert.equal(lookupInvite(d, 'AAAAAAAAAA', 'u2', T0).status, 'member');
  redeem(d.invites.AAAAAAAAAA, 'u4', T0);
  assert.equal(lookupInvite(d, 'AAAAAAAAAA', 'u2', T0).status, 'member', 'whatever the code says');
  assert.equal(lookupInvite(d, 'AAAAAAAAAA', 'u3', T0).status, 'used');
  assert.equal(lookupInvite(d, 'BBBBBBBBBB', 'u3', T0).status, 'valid');
  assert.equal(lookupInvite(d, 'BBBBBBBBBB', 'u5', T0), null);
  assert.equal(lookupInvite(d, 'CCCCCCCCCC', 'u3', T0), null);
  assert.equal(lookupInvite(d, 'DDDDDDDDDD', 'u3', T0), null);
  assert.equal(lookupInvite(d, null, 'u3', T0), null);
});

test('minting keeps at most 20 live codes per member and group, and forgets codes spent a month ago', () => {
  const d = withGroup(['u1', 'u2']);
  for (let i = 0; i < LIVE_CODES_PER_MEMBER; i++) d.invites[`A${String(i).padStart(9, 'A')}`] = newGroupInvite({ group: 'g1', by: 'u1', now: T0 + i });
  d.invites.OTHERAAAAA = newGroupInvite({ group: 'g1', by: 'u2', now: T0 });
  d.invites.OLDAAAAAAA = { ...newGroupInvite({ group: 'g1', by: 'u2', now: T0 - 40 * DAY }) };
  d.invites.USEDAAAAAA = newGroupInvite({ group: 'g1', by: 'u2', now: T0 });
  redeem(d.invites.USEDAAAAAA, 'u3', T0);
  tidyInvites(d, 'g1', 'u1', T0 + DAY);
  const live = Object.entries(d.invites).filter(([, inv]) => inv.by === 'u1' && codeStatus(inv, T0 + DAY) === 'valid');
  assert.equal(live.length, LIVE_CODES_PER_MEMBER - 1, 'room for the one being minted');
  assert.equal(codeStatus(d.invites.AAAAAAAAA0, T0 + DAY), 'revoked', 'the oldest goes');
  assert.equal(codeStatus(d.invites.AAAAAAAAA1, T0 + DAY), 'valid');
  assert.equal(codeStatus(d.invites.OTHERAAAAA, T0 + DAY), 'valid', 'another member’s are untouched');
  assert.equal(d.invites.OLDAAAAAAA, undefined, 'expired a month ago');
  assert.equal(codeStatus(d.invites.USEDAAAAAA, T0 + DAY), 'used', 'used yesterday: kept, so it says used');
});

test('an open invitation is one whose code still works', () => {
  const d = withGroup(['u1']);
  d.invites.BBBBBBBBBB = newGroupInvite({ group: 'g1', by: 'u1', to: 'u3', now: T0 });
  d.invitations.push({ code: 'BBBBBBBBBB', group: 'g1', from: 'u1', to: 'u3' });
  assert.ok(hasOpenInvitation(d, 'g1', 'u3', T0));
  assert.ok(!hasOpenInvitation(d, 'g1', 'u3', T0 + 7 * DAY));
  assert.ok(!hasOpenInvitation(d, 'g1', 'u4', T0));
});

test('summaryNumbers answers zeros and the goal as data (api-m2 replaces the numbers)', () => {
  assert.deepEqual(summaryNumbers({ goal: { kind: 'number', n: 15 } }, 'u1', '2026-10-21'), { week: { done: 0, planned: 0 }, streak: 0, goalLine: { kind: 'number', n: 15 } });
  assert.deepEqual(summaryNumbers({ goal: { kind: 'targets' } }, 'u1', null).goalLine, { kind: 'targets' });
});
