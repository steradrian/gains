# Sync: listing the profiles (`GET /api/sync/users`)

The hub (the gateway's sync worker) syncs one profile at a time through `/api/sync/*`, each call
carrying a short-lived hub token for that profile (`api/hub-token.js`). Until this route the hub had
no way to ask openGym who exists. It learned about a person only after they opened the app and the
frontend called the hub's `sync/now`, so someone who logged a workout on another device, or came
back after a while, was never polled.

`GET /api/sync/users` answers that. This page records how it is authorised and why, because that is
the part that is easy to get wrong.

## What it returns

```
GET /api/sync/users?after=<id>&limit=<1..500, default 100>

200 {
  "users": [
    { "id": "Vh3kQ9w2ZbYc0aLm", "state": "active",   "rev": 412 },
    { "id": "Wk8pD1x4NfR7sTq2", "state": "disabled", "rev": 37 },
    { "id": "Zr2mC6y0LgH3vBn9", "state": "gone",     "rev": 0, "gone_at": 1760430999000 }
  ],
  "next_after": null
}
```

- `state` is `active`, `disabled` or `gone`. A disabled profile is one the hub should stop syncing,
  as it already is told by `disabled` on the per-profile routes; `gone` is a deleted one.
- `rev` is the same revision `GET /api/sync/rev` gives for that profile (`0` when it has no state
  yet). The hub reads a profile's own routes only when it moved.
- Only these fields. No name, e-mail, passkey, device or anything from a profile's data. The id is
  what the hub already signs per-profile tokens with.
- Deleted profiles are remembered as `{ id, at }` in `db.json` (`gone`) for 90 days, at most 1000, so
  the hub can tell "stop syncing this person" from "never heard of them". After that the id simply
  stops appearing.

### Paging

Paged by key, not by position: ordered by id, and `after` is the last id of the page before
(`next_after`, `null` at the end). A profile created, disabled or deleted between two pages never
makes another one repeat or go missing, which an offset into a list that has just changed would. One
created behind the cursor after the pass went by is in the next pass. The list is one entry per
profile on the instance and is meant to be walked in full each time; the hub compares each `rev` with
the one it last saw.

## How it is authorised

The route is about no single profile, so it cannot take a per-profile token (`sub` is a profile id,
and the route would have to ignore it). Three ways to give it a credential were considered:

| Option | Verdict |
|---|---|
| A. A per-profile-style token with `sub` set to a service principal and `scope=sync-list`, same audience | Works, but the only thing keeping it off the per-profile routes (and them off it) is the scope check. One mistaken `scopes: ['sync', 'sync-list']` on any route and a listing token reads profiles. |
| **B. Its own audience (`opengym-sync-users`), scope `sync-list`, and `sub` = `hub`** | **Chosen.** Refused on every other route on audience *and* scope, and refused here on both too. No single mistake in a route's scope list lets one kind of token in as the other. |
| C. A static API key in the environment | Rejected: no expiry, no one-use rule, nothing to rotate except by redeploying, and a second secret to leak. A hub token is already short-lived, single-use and signed with a key openGym holds only the public half of. |

The decision is option B:

- `aud` = `opengym-sync-users`, a string, never an array.
- `scope` = `sync-list`.
- `sub` = `hub`: the hub acting as a service, never a profile id. A token whose `sub` names anyone
  else is refused with `token-invalid` (audited as `sync.token.fail`, reason `sub`): it was minted
  for something else, and does not become a listing credential by being re-aimed.
- Everything else is what every hub token already is (`api/hub-token.js`): the same `HUB_JWKS` key and
  `HUB_ISSUER`, ES256 only, `exp` in the future, `iat` at most 30 s ahead, a lifetime of at most 60 s,
  a `jti` of at least 128 random bits, and **one use** (the replay cache is shared with the
  per-profile routes, so a `jti` cannot be reused across routes either).
- Refused everywhere else, and it refuses everything else: a per-profile token here gets `401
  token-invalid`, a listing token on any per-profile route gets `401 token-invalid`, a cookie or a
  paired token here is the same as no credential (`401 not signed in`).
- Like the rest of `/api/sync/*`, it does not exist unless `HUB_JWKS` is set: an instance with no hub
  answers the plain `404 not found`.

Failures are audited as `sync.token.fail` with a reason code. A successful listing is not audited
(it is called on a schedule); the token itself is never logged.

## What the hub has to change

openGym's side is this route and nothing else; the hub is a separate repo.

1. **Mint a listing token** for `GET /api/sync/users`: the same ES256 key and issuer it uses now, with
   `aud: "opengym-sync-users"`, `scope: "sync-list"`, `sub: "hub"`, `iat`/`exp` (`exp - iat <= 60`) and
   a fresh `jti` of at least 128 random bits, per call (including every page).
2. **Poll the listing** on a schedule (and on `sync/now`), walking `next_after` until it is `null`.
3. For each `active` profile whose `rev` differs from the one it last saw, run its normal per-profile
   pass with a per-profile token (`aud: "opengym-sync"`, `scope: "sync"`, `sub` = the id).
4. Treat `disabled` like the per-profile `disabled` answer (stop syncing, keep the data), and `gone`
   like `user-gone` (stop syncing; hold deletes behind the same guard it uses for a `reset_at`).
5. Do not rely on a profile's absence from a page as deletion: a profile created or restored behind
   the cursor mid-pass is simply for the next pass.
