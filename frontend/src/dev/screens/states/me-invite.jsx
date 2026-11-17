import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useUI } from '../../../store/useUI.js'
import { waitingLine } from '../../../views/me/invite/invite-data.js'
import InviteRoute from '../../../views/me/invite/InviteRoute.jsx'
import { registerScreens } from '../registry.js'
import { ASKS, MARA, MINE, NAMELESS, askMemoryBackend, memoryBackend } from './me-invite-fixture.js'

// Me > Invite a friend (boards Me5Invite M5.0, Me5Create M5.1, Me5Created M5.2, Me5Error M5.3 and the
// PR05Edges row "Couldn't load invites, Invite expired"): the real route over an in-memory backend,
// so Create, Revoke and Try again run the real flow and nothing reaches the network or the clipboard.
// The toast is the app's own, held open. The admin is the mocked user.

const mock = { user: { id: 'u_admin', name: 'Adrian', admin: true } }

// The backend is made once per showing of a state: a created invite only joins this showing's list.
function Showing({ backend, canShare = true }) {
  const [mem] = useState(() => memoryBackend(backend))
  return <InviteRoute backend={mem} canShare={canShare} />
}
const showing = (backend, canShare) => () => <Showing backend={backend} canShare={canShare} />

const hold = async t => {
  useUI.getState().pauseToast()
  await t.wait(60)
}
const openCreate = async t => { await t.click('Create an invite link'); await t.wait(300) }
const create = async t => {
  await openCreate(t)
  await t.type('Their name', 'Andrei')
  await t.click('Create and copy link')
  await t.wait(200)
  await hold(t)
}
const openMenu = async t => { await t.click('Mara' + waitingLine(MARA)); await t.wait(300) }

registerScreens('Me: invite', [
  { id: 'M5.0', title: 'Invite a friend', note: 'The card and the groups: Waiting (Mara), Joined 2 (Radu, Ioana) and Expired (Vlad, with New link).',
    render: showing({}), path: '/me/invite', mock },
  { id: 'M5.1', title: 'New invite', note: 'Their name with the hint, Create and copy link and Create and share.',
    render: showing({}), path: '/me/invite', mock, play: openCreate },
  { id: 'M5.2', title: 'Link created', note: 'Andrei on top of Waiting ("created now, link copied", New); the toast offers Revoke for 8 s (held here). Revoke is not an Undo.',
    render: showing({}), path: '/me/invite', mock, play: create },
  { id: 'M5.2s', title: 'Link shared', note: 'Create and share: the row says "link shared" because the share sheet resolved.',
    render: showing({}), path: '/me/invite', mock,
    play: async t => { await openCreate(t); await t.type('Their name', 'Andrei'); await t.click('Create and share'); await t.wait(200); await hold(t) } },
  { id: 'M5.2c', title: 'Link created, copy failed', note: 'The clipboard refused: the toast says to copy the link from the list.',
    render: showing({ deliver: null }), path: '/me/invite', mock, play: create },
  { id: 'M5.1e', title: 'New invite failed', note: 'The server refused: the message sits in the drawer, which stays open.',
    render: showing({ createFails: 'Too many invites. Try again later.' }), path: '/me/invite', mock,
    play: async t => { await openCreate(t); await t.click('Create and copy link'); await t.wait(200) } },
  { id: 'M5.1n', title: 'New link', note: 'New link on Vlad\'s expired invite: the drawer opens with his name.',
    render: showing({}), path: '/me/invite', mock, play: async t => { await t.click('New link'); await t.wait(300) } },
  { id: 'M5.1u', title: 'New invite, no share sheet', note: 'A browser with no share sheet: Create and copy link only.',
    render: showing({}, false), path: '/me/invite', mock, play: openCreate },
  { id: 'M5.3', title: 'Couldn\'t load invites', note: 'The header and card stay; the search scene, a line and Try again. Create still works.',
    render: showing({ loadFails: 'always' }), path: '/me/invite', mock },
  { id: 'M5.3r', title: 'Try again', note: 'The first load fails; Try again loads the list.',
    render: showing({ loadFails: 'once' }), path: '/me/invite', mock, play: async t => { await t.click('Try again'); await t.wait(200) } },
  { id: 'M5.0a', title: 'Asked', note: 'Two members\' asks above Waiting: a note, or the day it was made; New invite answers one.',
    render: showing({ requests: ASKS }), path: '/me/invite', mock },
  { id: 'M5.0q', title: 'Answering an ask', note: 'New invite on an ask: the drawer names the asker and the note.',
    render: showing({ requests: ASKS }), path: '/me/invite', mock, play: async t => { await t.click('New invite'); await t.wait(300) } },
  { id: 'M5.0m', title: 'A waiting invite', note: 'Tapping Mara: Copy link, Share link and Revoke.',
    render: showing({}), path: '/me/invite', mock, play: openMenu },
  { id: 'M5.0r', title: 'Revoke this invite?', note: 'Revoke opens the confirm as a sub-panel of the menu, never a drawer on a drawer.',
    render: showing({}), path: '/me/invite', mock, play: async t => { await openMenu(t); await t.click('Revoke'); await t.wait(400) } },
  { id: 'M5.0o', title: 'Sign-up is open', note: 'The server says sign-up is open: the card says invites are optional.',
    render: showing({ inviteOnly: false }), path: '/me/invite', mock },
  { id: 'M5.0l', title: 'Loading invites', note: 'Skeleton rows under the card.',
    render: showing({ loadNever: true }), path: '/me/invite', mock },
  { id: 'M5.0e', title: 'No invites yet', note: 'The card and its button are the whole page.',
    render: showing({ invites: [] }), path: '/me/invite', mock },
  { id: 'M5.0k', title: 'An invite with no name', note: 'The row reads "Invite" and the first characters of the code, never the code.',
    render: showing({ invites: [MARA, NAMELESS] }), path: '/me/invite', mock },
])

// Me invite M3: the member's view (boards Me5AskAdmin M5.4, Me5Asked M5.5, PR05Edges row M5.0 "Not an
// admin"): the real route over an in-memory ask backend, so Ask, Undo and Withdraw run the real
// flow and nothing reaches the network. The toast is the app's own, held open.
const member = { user: { id: 'u_mara', name: 'Mara', admin: false } }

function MemberShowing({ options, groupsOn = false }) {
  const [backend] = useState(() => askMemoryBackend(options))
  return <InviteRoute askBackend={backend} groupsOn={groupsOn} />
}
const asking = (options, groupsOn) => () => <MemberShowing options={options} groupsOn={groupsOn} />

// A build with no signed-in account has no Invite page: the route sends it to the Me root.
function GuestShowing() {
  return (
    <Routes>
      <Route path="/me/invite" element={<InviteRoute />} />
      <Route path="*" element={<p>Redirected to the Me root (/me)</p>} />
    </Routes>
  )
}

const writeNote = async (t, note = 'My training partner Andrei') => { await t.type('Your note', note); await t.wait(60) }
const askNow = async t => {
  await writeNote(t)
  await t.click('Ask an admin')
  await t.wait(200)
}

registerScreens('Me: invite', [
  { id: 'M5.4', title: 'Ask an admin', note: 'A member opens Invite a friend: who can invite, the Your note field with its hint, and Ask an admin (off until there is a note).',
    render: asking(), path: '/me/invite', mock: member },
  { id: 'M5.4w', title: 'Ask an admin, note written', note: 'The note typed: Ask an admin is on.',
    render: asking(), path: '/me/invite', mock: member, play: writeNote },
  { id: 'M5.5', title: 'Asked', note: 'The toast "Asked an admin" with Undo for 8 s (held here); the field is clear and the ask is listed with Withdraw.',
    render: asking(), path: '/me/invite', mock: member, play: async t => { await askNow(t); await hold(t) } },
  { id: 'M5.5u', title: 'Asked, undone', note: 'Undo withdraws the ask: the row leaves.',
    render: asking(), path: '/me/invite', mock: member, play: async t => { await askNow(t); await t.click('Undo'); await t.wait(200) } },
  { id: 'M5.4o', title: 'Open asks', note: 'One open ask with Withdraw, under the form.',
    render: asking({ requests: MINE.slice(0, 1) }), path: '/me/invite', mock: member },
  { id: 'M5.4x', title: 'Withdrawn', note: 'Withdraw: the row leaves.',
    render: asking({ requests: MINE.slice(0, 1) }), path: '/me/invite', mock: member, play: async t => { await t.click('Withdraw'); await t.wait(200) } },
  { id: 'M5.4c', title: 'At the cap', note: '3 open asks: Ask an admin is off and a line says so; withdrawing one turns it back on.',
    render: asking({ requests: MINE }), path: '/me/invite', mock: member, play: writeNote },
  { id: 'M5.4d', title: 'Asked 3 times today', note: 'The server\'s daily limit (429, reason daily) with the wait it gave; the note stays.',
    render: asking({ askFails: 'daily' }), path: '/me/invite', mock: member, play: askNow },
  { id: 'M5.4q', title: 'Open asks limit', note: 'The server\'s open limit (429, reason open): no time promised.',
    render: asking({ askFails: 'open' }), path: '/me/invite', mock: member, play: askNow },
  { id: 'M5.4f', title: 'Offline', note: 'No answer from the server: the note stays and Try again is on the error.',
    render: asking({ askFails: 'offline' }), path: '/me/invite', mock: member, play: askNow },
  { id: 'M5.4g', title: 'Friends on', note: 'With Friends on, a Groups row points to adding people who are already in.',
    render: asking({}, true), path: '/me/invite', mock: member },
  { id: 'M5.0n', title: 'Not an admin, no account', note: 'A guest, demo or phone-only build has no Invite: the route goes back to the Me root.',
    render: () => <GuestShowing />, path: '/me/invite', mock: { user: null } },
])
