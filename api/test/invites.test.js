/* Invite expiry, single use, the public check and members' invite requests (invites.js). The
   routes are in server-invites.test.js and server-invite-requests.test.js. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INVITE_TTL_MS, INVITE_TTL_DAYS, inviteStatus, usableInvite, newInvite, migrateInvites, revokeInvite, inviteCheck, inviteName, codeHint,
  REQUEST_NOTE_MAX, REQUEST_OPEN_MAX, REQUEST_DAY_MAX, requestNote, askForInvite, myRequests, cancelRequest, openRequests,
  fulfilRequest, pruneRequests
} from '../invites.js';

const NOW = Date.UTC(2026, 9, 15, 12);
const iso = ms => new Date(ms).toISOString();
const DAY = 86400000;

describe('inviteStatus', () => {
  const fresh = newInvite({ code: 'AAAA1111BBBB2222', note: '', createdBy: 'adm', now: NOW });

  it('is valid for seven days after it was made, and expired from then on', () => {
    assert.equal(fresh.expiresAt, iso(NOW + 7 * DAY));
    assert.equal(INVITE_TTL_DAYS, 7);
    assert.equal(INVITE_TTL_MS, 7 * DAY);
    assert.equal(inviteStatus(fresh, NOW), 'valid');
    assert.equal(inviteStatus(fresh, NOW + 7 * DAY - 1), 'valid');
    assert.equal(inviteStatus(fresh, NOW + 7 * DAY), 'expired');
  });

  it('keeps the expiry an invite was made with when the lifetime changes', () => {
    const older = { code: 'OLD14', created: iso(NOW), expiresAt: iso(NOW + 14 * DAY) };
    assert.equal(migrateInvites([older], NOW), false);
    assert.equal(older.expiresAt, iso(NOW + 14 * DAY));
    assert.equal(inviteStatus(older, NOW + 10 * DAY), 'valid', 'a fourteen-day invite made before the change still works on day ten');
  });

  it('is used once someone signed up with it, whatever its date says', () => {
    assert.equal(inviteStatus({ ...fresh, usedBy: 'u9' }, NOW), 'used');
    assert.equal(inviteStatus({ ...fresh, usedBy: 'u9' }, NOW + 30 * DAY), 'used');
  });

  it('is revoked once revoked, and an invite with no readable expiry is expired', () => {
    const inv = { ...fresh };
    revokeInvite(inv, NOW);
    assert.equal(inviteStatus(inv, NOW), 'revoked');
    assert.equal(inv.revokedAt, iso(NOW));
    assert.equal(inviteStatus({ code: 'X', expiresAt: 'soon' }, NOW), 'expired');
    assert.equal(inviteStatus({ code: 'X' }, NOW), 'expired');
  });
});

describe('usableInvite', () => {
  const invites = [
    newInvite({ code: 'GOOD0000GOOD0000', note: '', createdBy: 'adm', now: NOW }),
    { ...newInvite({ code: 'USED0000USED0000', note: '', createdBy: 'adm', now: NOW }), usedBy: 'u1' },
    newInvite({ code: 'OLD00000OLD00000', note: '', createdBy: 'adm', now: NOW - 15 * DAY })
  ];

  it('finds only an invite that can still sign someone up', () => {
    assert.equal(usableInvite(invites, 'GOOD0000GOOD0000', NOW)?.code, 'GOOD0000GOOD0000');
    assert.equal(usableInvite(invites, 'USED0000USED0000', NOW), null);
    assert.equal(usableInvite(invites, 'OLD00000OLD00000', NOW), null);
    assert.equal(usableInvite(invites, 'NOPE', NOW), null);
    assert.equal(usableInvite(undefined, 'GOOD0000GOOD0000', NOW), null);
  });
});

describe('migrateInvites', () => {
  it('gives every invite from before expiry the full lifetime from now, once', () => {
    const made = iso(NOW - 100 * DAY);
    const invites = [
      { code: 'A', created: made },
      { code: 'B', created: made, usedBy: 'u1' },
      { code: 'C', created: made, expiresAt: iso(NOW + DAY) }
    ];
    assert.equal(migrateInvites(invites, NOW), true);
    assert.equal(invites[0].expiresAt, iso(NOW + 7 * DAY));
    assert.equal(invites[1].expiresAt, iso(NOW + 7 * DAY));
    assert.equal(invites[2].expiresAt, iso(NOW + DAY), 'one that has an expiry keeps it');
    assert.equal(inviteStatus(invites[0], NOW), 'valid', 'an unused old invite still works after the update');
    assert.equal(inviteStatus(invites[1], NOW), 'used');
    assert.equal(migrateInvites(invites, NOW + DAY), false, 'a second boot changes nothing');
    assert.equal(invites[0].expiresAt, iso(NOW + 7 * DAY));
  });
});

describe('inviteCheck', () => {
  const users = [{ id: 'adm', name: 'Adrian', pw: { h: 'secret' } }, { id: 'u1', name: 'Bea' }];
  const invites = [
    newInvite({ code: 'AAAA1111BBBB2222', note: 'for my sister', name: 'Ana', createdBy: 'adm', now: NOW }),
    { ...newInvite({ code: 'CCCC3333DDDD4444', note: 'gym buddy', name: 'Carl', createdBy: 'adm', now: NOW }), usedBy: 'u1', usedAt: iso(NOW) },
    newInvite({ code: 'EEEE5555FFFF6666', note: '', name: 'Eve', createdBy: 'gone-admin', now: NOW })
  ];

  it('answers the status, the inviter and the suggested name of a usable invite, in any case', () => {
    assert.deepEqual(inviteCheck(invites, users, 'AAAA1111BBBB2222', NOW), { status: 'valid', inviterName: 'Adrian', suggestedName: 'Ana' });
    assert.deepEqual(inviteCheck(invites, users, 'aaaa1111bbbb2222', NOW), { status: 'valid', inviterName: 'Adrian', suggestedName: 'Ana' });
  });

  it('names nobody for a used, revoked or expired one: the status only', () => {
    assert.deepEqual(inviteCheck(invites, users, 'CCCC3333DDDD4444', NOW), { status: 'used', inviterName: null, suggestedName: null });
    assert.deepEqual(inviteCheck(invites, users, 'AAAA1111BBBB2222', NOW + 15 * DAY), { status: 'expired', inviterName: null, suggestedName: null });
    const revoked = invites.map(i => ({ ...i }));
    revokeInvite(revoked[0], NOW);
    assert.deepEqual(inviteCheck(revoked, users, 'AAAA1111BBBB2222', NOW), { status: 'revoked', inviterName: null, suggestedName: null });
  });

  it('hints at a code for the audit log without giving it away', () => {
    assert.equal(codeHint('AAAA1111BBBB2222'), 'AAAA…');
    assert.equal(codeHint(undefined), '');
  });

  it('says nothing of an inviter whose profile is gone', () => {
    assert.deepEqual(inviteCheck(invites, users, 'EEEE5555FFFF6666', NOW), { status: 'valid', inviterName: null, suggestedName: 'Eve' });
  });

  it('leaks nothing else: no note, no user, no dates, no ids', () => {
    for (const code of ['AAAA1111BBBB2222', 'CCCC3333DDDD4444']) {
      const r = inviteCheck(invites, users, code, NOW);
      assert.deepEqual(Object.keys(r).sort(), ['inviterName', 'status', 'suggestedName']);
      const text = JSON.stringify(r);
      for (const secret of ['sister', 'buddy', 'Bea', 'u1', 'adm', 'secret', '2026']) assert.ok(!text.includes(secret), secret);
    }
  });

  it('answers null for a code that names no invite, or is not a code at all', () => {
    for (const code of ['ZZZZ0000ZZZZ0000', '', 'a/b', '../db.json', 'x'.repeat(65), 'AB', null, 42]) {
      assert.equal(inviteCheck(invites, users, code, NOW), null, String(code));
    }
  });

  it('never uses the invite up', () => {
    const before = JSON.stringify(invites);
    inviteCheck(invites, users, 'AAAA1111BBBB2222', NOW);
    assert.equal(JSON.stringify(invites), before);
  });
});

describe('inviteName', () => {
  it('folds control and invisible characters and caps the length', () => {
    assert.equal(inviteName('  Ana\u0000 ‮Maria  '), 'Ana Maria');
    assert.equal(inviteName('x'.repeat(100)).length, 40);
    assert.equal(inviteName(42), '');
    assert.equal(newInvite({ code: 'C', note: '', name: '   ', createdBy: 'a', now: NOW }).name, undefined);
  });
});

describe('invite requests', () => {
  let n = 0;
  const ask = (requests, by, note, now = NOW) => askForInvite(requests, { id: `r${++n}`, by, note, now });

  it('cleans the note like a name, with a cap of its own', () => {
    assert.equal(REQUEST_NOTE_MAX, 120);
    assert.equal(requestNote('  my\u0000 sister\n\n Ana  '), 'my sister Ana');
    assert.equal(requestNote('x'.repeat(300)).length, 120);
    assert.equal(requestNote(undefined), '');
    assert.equal(requestNote({ toString: () => 'no' }), '');
  });

  it('stores an open request and answers it again for the same note while it is open', () => {
    const requests = [];
    const first = ask(requests, 'u1', ' Ana ');
    assert.equal(first.ok, true);
    assert.equal(first.created, true);
    assert.deepEqual(requests, [{ id: first.request.id, by: 'u1', note: 'Ana', at: iso(NOW), status: 'open' }]);
    const again = ask(requests, 'u1', 'Ana');
    assert.deepEqual([again.ok, again.created, again.request.id], [true, false, first.request.id]);
    assert.equal(requests.length, 1, 'a retried tap is not a second ask');
    // Someone else's identical note is their own ask.
    assert.equal(ask(requests, 'u2', 'Ana').created, true);
    assert.equal(requests.length, 2);
  });

  it(`allows ${REQUEST_DAY_MAX} asks a day per person, withdrawn ones included, and says when the next one is`, () => {
    const requests = [];
    const a = ask(requests, 'u1', 'one', NOW);
    ask(requests, 'u1', 'two', NOW + 1000);
    cancelRequest(requests, { id: a.request.id, by: 'u1', now: NOW + 2000 });
    ask(requests, 'u1', 'three', NOW + 3000);
    const over = ask(requests, 'u1', 'four', NOW + 4000);
    assert.equal(over.ok, false);
    assert.equal(over.reason, 'daily');
    assert.equal(over.retryAfter, (DAY - 4000) / 1000, 'until the oldest ask leaves the window');
    assert.equal(requests.length, 3, 'nothing stored');
    assert.equal(ask(requests, 'u2', 'four', NOW + 4000).ok, true, 'another person is not counted');
    assert.equal(ask(requests, 'u1', 'four', NOW + DAY + 1).ok, true, 'a day after the first, one more');
  });

  it(`allows ${REQUEST_OPEN_MAX} open at once, which only answering or withdrawing lifts`, () => {
    const requests = [];
    const first = ask(requests, 'u1', 'one', NOW - 3 * DAY);
    ask(requests, 'u1', 'two', NOW - 2 * DAY);
    ask(requests, 'u1', 'three', NOW - DAY);
    const over = ask(requests, 'u1', 'four', NOW);
    assert.deepEqual([over.ok, over.reason, over.retryAfter], [false, 'open', DAY / 1000]);
    // The same note as an open one is still answered, at the cap too.
    assert.equal(ask(requests, 'u1', 'two', NOW).ok, true);
    fulfilRequest(requests, first.request.id, { code: 'AAAA1111BBBB2222', adminId: 'adm', now: NOW });
    assert.equal(ask(requests, 'u1', 'four', NOW).ok, true);
  });

  it('lists only the asker\'s own open requests, without who asked', () => {
    const requests = [];
    const mine = ask(requests, 'u1', 'Ana');
    const done = ask(requests, 'u1', 'Bea');
    const gone = ask(requests, 'u1', 'Cy');
    ask(requests, 'u2', 'not yours');
    fulfilRequest(requests, done.request.id, { code: 'C0DE', adminId: 'adm' });
    cancelRequest(requests, { id: gone.request.id, by: 'u1' });
    assert.deepEqual(myRequests(requests, 'u1'), [{ id: mine.request.id, note: 'Ana', at: iso(NOW) }]);
    assert.deepEqual(myRequests(requests, 'nobody'), []);
  });

  it('withdraws only the asker\'s own open request', () => {
    const requests = [];
    const theirs = ask(requests, 'u2', 'Ana');
    assert.equal(cancelRequest(requests, { id: theirs.request.id, by: 'u1' }), false, 'someone else\'s');
    assert.equal(requests[0].status, 'open');
    assert.equal(cancelRequest(requests, { id: 'nope', by: 'u2' }), false);
    assert.equal(cancelRequest(requests, { id: theirs.request.id, by: 'u2', now: NOW + 5 }), true);
    assert.deepEqual([requests[0].status, requests[0].cancelledAt], ['cancelled', iso(NOW + 5)]);
    assert.equal(cancelRequest(requests, { id: theirs.request.id, by: 'u2' }), false, 'twice');
  });

  it('lists open requests to admins with the asker\'s name, leaving out gone and disabled askers', () => {
    const users = [{ id: 'u1', name: 'Bea' }, { id: 'u3', name: 'Lock', disabled: true }, { id: 'u4', name: '' }];
    const requests = [];
    const a = ask(requests, 'u1', 'my sister');
    ask(requests, 'u3', 'locked');
    ask(requests, 'deleted', 'orphan');
    const d = ask(requests, 'u4', '');
    const done = ask(requests, 'u1', 'answered');
    fulfilRequest(requests, done.request.id, { code: 'C0DE', adminId: 'adm' });
    assert.deepEqual(openRequests(requests, users), [
      { id: a.request.id, name: 'Bea', note: 'my sister', at: iso(NOW), by: 'u1' },
      { id: d.request.id, name: null, note: '', at: iso(NOW), by: 'u4' }
    ]);
  });

  it('marks a request answered with a hint of the code, and ignores one that is not open', () => {
    const requests = [];
    const r = ask(requests, 'u1', 'Ana');
    const got = fulfilRequest(requests, r.request.id, { code: 'AAAA1111BBBB2222', adminId: 'adm', now: NOW + 9 });
    assert.equal(got, requests[0]);
    assert.deepEqual(
      [got.status, got.doneAt, got.doneBy, got.inviteCode],
      ['done', iso(NOW + 9), 'adm', 'AAAA…']
    );
    assert.ok(!JSON.stringify(requests).includes('AAAA1111BBBB2222'), 'never the code itself');
    assert.equal(fulfilRequest(requests, r.request.id, { code: 'X', adminId: 'adm' }), null, 'already done');
    for (const id of ['nope', '', undefined, 42, { id: r.request.id }]) {
      assert.equal(fulfilRequest(requests, id, { code: 'X', adminId: 'adm' }), null, String(id));
    }
  });

  it('prunes answered and withdrawn requests after a day, never an open one', () => {
    const requests = [];
    const open = ask(requests, 'u1', 'waiting', NOW - 30 * DAY);
    const done = ask(requests, 'u1', 'done', NOW - 2 * DAY);
    const fresh = ask(requests, 'u1', 'withdrawn', NOW - 1000);
    fulfilRequest(requests, done.request.id, { code: 'C0DE', adminId: 'adm' });
    cancelRequest(requests, { id: fresh.request.id, by: 'u1' });
    assert.equal(pruneRequests(requests, NOW), true);
    assert.deepEqual(requests.map(r => r.id), [open.request.id, fresh.request.id]);
    assert.equal(pruneRequests(requests, NOW), false);
  });
});
