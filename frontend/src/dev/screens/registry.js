// The screens gallery's list of states (#/dev/screens, dev server only; DevScreens.jsx). A state is
// one screen in one situation, rendered for real with mocked data. Each PR that builds screens adds
// a file to ./states/ that calls registerScreens; the gallery picks every file there up by itself.
//
//   registerScreens('Sign in', [
//     { id: 'S0.2', title: 'Passkey not confirmed', render: () => <Login />, mock: {…}, play: async t => {…} },
//   ])
//
// An entry:
//   id      the board's id, unique, what the URL carries: #/dev/screens/S0.2
//   title   the board's title
//   note    optional, one line under it in the index (what is special about this state)
//   render  the screen's element, the real component. A drawer state renders its host screen and
//           `play` opens the drawer, so the drawer sits over the screen it belongs to.
//   path    the route it starts on in the phone-sized frame (default '/'), for a screen that
//           lives on its own route; `render` is then the screen behind it
//   mock    what the screen's calls get back (mock-env.js): config, user, linkCode, webauthn,
//           api (route → answer), credentials
//   play    taps and typing that bring the screen to the state, for what only a person's input
//           reaches: { click(text), type(label, value), submit(), wait(ms) }
const areas = []   // [{ name, entries: [] }], in the order they were registered
const byId = new Map()

export function registerScreens(area, entries) {
  let group = areas.find(a => a.name === area)
  if (!group) { group = { name: area, entries: [] }; areas.push(group) }
  for (const entry of entries) {
    if (byId.has(entry.id)) throw new Error(`Screens gallery: "${entry.id}" is registered twice`)
    byId.set(entry.id, entry)
    group.entries.push(entry)
  }
}

export const screenAreas = () => areas
export const allScreens = () => [...byId.values()]
export const screenById = id => byId.get(id) || null
