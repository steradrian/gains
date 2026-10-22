# Gains Friends (PR-09) review

Branch `feat/friends` against `origin/main`. Single lean reviewer; only verified red and yellow findings. Counts: 1 red, 4 yellow.

## R1. Creating a challenge with a far-future `date` deletes every challenge in every group

- File: `api/friends/challenges.js:31` (`dayOf`), `:62-66`, `:70`.
- Trigger: any Friends-on member of any group sends `POST /api/friends/groups/{id}/challenges?date=2099-12-31` with a valid body. `dayOf` only runs `isDate` (2000 to 2099); there is no `plausibleDate` guard, unlike cheers and the week settle. Inside the mutate, the cleanup loop `for (const [cid, c] of Object.entries(d.challenges)) if (c.end < addDays(day, -KEEP_DAYS)) delete` runs over all groups' challenges, not only this group's. Every challenge that ends before 2099-11-01 is deleted.
- Verified: a script against `createFriendsStore` + `challengeRoutes` with a challenge in group G2 and the request from a member of G1 only. After the call the G2 challenge was gone (`live in challenges` was false).
- Side effects of the same unguarded date: the new challenge starts in 2099 (`weekOf(day)`), and up to three such challenges fill `ACTIVE_MAX` for the group (`challenge-limit`) with no way to remove them. A phone with a wrong clock does the same by accident. Cheers refs to the deleted challenges now 404.
- Fix: in all three challenge writes use the client date only when `plausibleDate(date)` (week.js), else the server UTC date. Run the retention sweep off the server clock (`Date.now()`) and only for the group being written to. Add a test: a write with `date=2099-12-31` leaves other groups' challenges untouched.

## Y1. Rejoining a group you left shows a stale page that never refreshes

- File: `frontend/src/lib/friends/use-group.js:89`, `:93`, `:217`.
- Trigger: Leave group G, then redeem a new invite for G in the same tab and open `/me/groups/G`. `leaveThisGroup` sets the entry's `status: 'left'` and keeps the old `group`; nothing resets it (`resetGroups` has no caller outside tests). `load()` drops both the success and the error branch while `status === 'left'`, and the `loading` put is skipped because `group` is non-null. The page renders the pre-leave group (old members, moments, ring) and every refetch and every cheer `reload` is discarded until a full reload. The Leave confirm tells the person "you can only come back with a new invite", so this is the promised path.
- Fix: clear the `left` mark when a screen starts watching again (in `watchGroup`, when `status === 'left'`, set `{ group: null, status: 'idle' }` first), or drop the entry in `leaveThisGroup` after the refetch instead of keeping a sticky status. Also call `resetGroups()` from `store.js` when `ownerOf()` changes, so another account on the same tab never sees the previous account's cached group while it loads.

## Y2. The "plausible date" window for settling weeks is 2 days, wide enough to close a running week early

- File: `api/friends/week.js:39`, `:44-48`, used in `groupWeek` (`:138`) and `settle` (`:104-116`).
- Trigger: on Saturday 12:00 UTC to Sunday 23:59 UTC a member sends `GET /groups/{id}?date=<next Monday>` (diff is at most 2 days, so it passes). `settle` sees `last < week`, writes `results[thisWeek]` from the numbers so far and never rewrites it (`Object.hasOwn(g.results, wk)` skips). Sunday's sessions then no longer count, and a hit week can be recorded as missed, which resets the streak for everyone in the group. A device clock one to two days ahead does the same without malice.
- A real client is at most 14 hours ahead of UTC (UTC+14), so 2 days is looser than any time zone needs.
- Fix: `PLAUSIBLE_MS = 86400000` (1 day) at most; better, compare dates not instants: accept `date` between server UTC date -1 and +1. Add a test with `date = server date + 2`.

## Y3. "Trained together" switch-off is irreversible and hides the moment for the other person too, with no confirm

- File: `frontend/src/components/WorkoutShareBlock.jsx:35-44` (`dropTogether`), server `api/friends/routes.js:468-488`.
- Confirmed: switching the row off calls `removeMoment(gid, mid)` for every group that holds the moment. The server adds the id to `group.removedMoments`, which hides it for all members. There is no restore route, the row turns into a disabled "Not shown in the group", and the switch never offers on again. It reads as a per-person share switch like the rows around it, so the other participant silently loses a moment they did nothing to remove.
- Rating: yellow. The brief says either person can remove it, so it is by design, but the control gives no warning and no way back.
- Fix: put the switch behind a short confirm ("This hides it for {name} too. It can't be undone."), or keep a per-participant `hiddenBy` list on the group so a person only hides it for themselves and can turn it on again. Minimum: confirm drawer plus copy.

## Y4. Protein challenge counts days regardless of the person's "Food targets" switch

- File: `api/friends/challenge-facts.js:22-26`, used by `challenge-data.js:78`.
- Trigger: a person shares targets, then switches "Food targets reached" off on one device while another device keeps a synced `S.targetsReached` (or the client has not yet cleared it, `useTargetsReachedActive` only runs while the app is open). They join a protein challenge: `joined[].count` shows their protein-day count to the group even though the targets switch is off. The ring and member page honour the switch (`stats.js` `sh.targets`); the challenge path does not.
- Fix: pass the member's `share.targets` into `memberFacts` (and its cache key) and count 0 protein days when it is off. A new best counted as a number without naming it is intended and stays.

## Checked, clean

1. API authorization: every `{id}` route goes through `memberGroup`/`groupFor`, so a non-member and an unknown id get the same 404 body, including members, mutes, prefs, invites, invites/user, moments remove, challenges, cheers and `GET /people?group=`. Remove: creator only, self refused (400), other members 403, unknown target 404. Join: status check, redeem and membership are one synchronous `store.mutate` (rollback on throw), so a racing second redeem sees `used`. Expiry at exactly 7 days, cap 12 checked at mint and at redeem (counts disabled accounts too). Preview returns status, inviter name, and for valid or already-member only id, name, `memberCount`, up to four initials; `usedBy` and `to` never leave.
2. Privacy projection: `stats.js`, `group-view.js`, `moments.js`, `cheer-data.js` build every object key by key; no weight, food, intake, photo, note or set data. `ownBestSet` in `GET /cheers` reads only the viewer's own state. New best carries a catalogue id and name, never a weight. Challenge facts return counts and dates only. Muted members' moments are dropped per viewer; left, removed and Friends-off members are out of every read.
3. Disable vs delete: disabled accounts fail `readSession` (writes refused), are hidden through `isActiveUser`/`visibleMember` on groups, members, moments, cheers, challenges, invitations, `/people`, digest and `/me`, and nothing is purged; the purge is only in `deleteUserData`, covering memberships, invites, invitations, mutes, cheers, challenge participation and high-water marks. No missed filter found.
4. Ring math: `done = max(projection, highWater)`; planned recomputed each read; streak reads only `results` and skips weeks nobody planned; weeks are Monday to Sunday on date strings (`weekOf`, `addDays`, no UTC conversion of stored dates). The only guard gap is Y2.
5. Digest: uses `S.reminder.tz` through `userNow`; empty or invalid tz continues with no fallback; window 19:00 to 22:00 local; `digestSent` per local date; `GET /cheers` moves `seen` only with `seen=1`, and the client passes it only from the Cheers page.
6. Sync fields: `workout.share` and `S.targetsReached` have no whitelist; merge and parity tests cover older-app push, concurrent edits and clearing. Defaults are never written (`shareOf` canonicalises to `{}` and deletes the field), `targetsReached` skips today and days without a goal or protein goal, and is cleared when Friends or the switch is off. Y3 is the only issue there.
7. Frontend flows: Turn on always goes through What you share and sends nothing until the button; Turn off asks first and keeps memberships; Create, Join, Leave and Remove clean their history entry before navigating (`closeThen`, `closeThenReplace`, `replace: true`); a 404 on a group refetch sets `gone`, toasts and replaces to Groups; Cheer, Mute and Leave challenge restore exactly on Undo, Leave group and Remove have none; `/g/:code` redirects to the join page and the pending code survives sign-in (`sessionStorage`, taken once authed and past onboarding). Y1 is the only gap.
8. Integration calls: no reference to the old tone ids or `g-mtone-white/blue/purple/orange/green` remains; `p role="heading" aria-level={3}` keeps the `.g-ipeople-h` and `.g-jsheet-h` styles; the `PAGE_EXEMPT` additions match the assertion in `ui-guards.test.js` and the FoodGate precedent. The `/g/<code>` nginx redirect is consistent with the other envsubst-safe variables in the template (not run).
9. Deleted behaviour: the removed lines in main's files are signature or copy changes with a new home (`ConfirmDrawer`/`GlassList`/`StageEmpty`/`Switch` gained props, the Notifications copy gained a Friends variant, `closeThenReplace` gained `state`); nothing is lost.

Noted for the owner, not a finding: a member with Friends off is hidden from others but can still read the group and member pages through the API (tested as intended in `friends-group-view.test.js`). The UI hides it.

Not run: the full suites. Verified by tracing and one scripted check for R1.
