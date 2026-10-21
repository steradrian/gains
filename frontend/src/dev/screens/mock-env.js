// What a screen in the gallery talks to, stubbed for as long as it is on show: the store's user,
// config and sign-in actions (so nothing is signed in, synced or saved), the network (fetch, for
// the app's own /api calls only), the browser's passkey prompt and whether it is online, and what
// the onboarding kept for this tab. The screens are the real ones; only what they call is
// replaced, and everything is put back when the state is left.
import { STORE_KEY } from '../../lib/onboarding/session.js'
import { useStore } from '../../store/useStore.js'

const STORE_KEYS = ['config', 'user', 'linkCode', 'setUser', 'adoptProfile', 'setGuest', 'loadConfig', 'pushState', 'pullState']

/** A passkey prompt the person closed. */
export const denied = () => Promise.reject(Object.assign(new Error('The operation either timed out or was not allowed.'), { name: 'NotAllowedError' }))
/** A passkey prompt that stays open. */
export const never = () => new Promise(() => {})
/** A passkey the browser made: the shape lib/api.js turns into JSON. */
export const madePasskey = () => Promise.resolve({
  id: 'gallery-key', rawId: new ArrayBuffer(8), type: 'public-key', authenticatorAttachment: 'platform',
  getClientExtensionResults: () => ({}),
  response: { clientDataJSON: new ArrayBuffer(8), attestationObject: new ArrayBuffer(8), getTransports: () => ['internal'] },
})
/** What the server sends to start a passkey ceremony. */
export const creationOptions = { challenge: 'AAAA', user: { id: 'AAAA', name: 'alex', displayName: 'Alex' }, excludeCredentials: [] }
export const requestOptions = { challenge: 'AAAA', allowCredentials: [] }

/** An `api` answer that never comes: a request still out. */
export const pending = Symbol('pending')

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Installs the stubs and returns the function that takes them out.
 * `api` maps 'METHOD /api/path' to a status and body, `{ status: 400, body: { code: 'link-invalid' } }`,
 * to just a body for a 200, or to `pending` (an answer that never comes); a call with no entry is
 * a 404 that says so, and a request for anything that is not under /api/ goes to the real network.
 * The hub's routes count as under it (/hub/api/onboarding is 'GET /api/onboarding').
 * `onboarding` is what the onboarding kept for this tab (lib/onboarding/state.js), `online: false`
 * a browser with no connection. `S` is laid over the store's own state (routines, plan, workouts)
 * while the state shows, and the store's own comes back after. While it is laid over, a change a
 * tap makes (`update`) stays in memory: the store's own update would save the mock over this
 * browser's copy of the real data and push it.
 */
export function installMocks({ config = null, user = null, linkCode = null, webauthn = true, api = {}, credentials = {}, onboarding = null, online = true, S = null } = {}) {
  const undo = []

  if (S) {
    const { S: own, update } = useStore.getState()
    useStore.setState({
      S: { ...own, ...S },
      update: mut => {
        const next = structuredClone(useStore.getState().S)
        mut(next)
        useStore.setState({ S: next })
      },
    })
    undo.push(() => useStore.setState({ S: own, update }))
  }

  const saved = Object.fromEntries(STORE_KEYS.map(k => [k, useStore.getState()[k]]))
  useStore.setState({
    config, user, linkCode,
    setUser: () => {}, adoptProfile: async () => ({}), setGuest: () => {}, loadConfig: async () => config,
    pushState: async () => {}, pullState: async () => {},
  })
  undo.push(() => useStore.setState(saved))

  const realFetch = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(typeof input === 'string' ? input : input.url, window.location.href).pathname
    const at = path.indexOf('/api/')
    if (at < 0) return realFetch(input, init)
    const key = (init.method || 'GET').toUpperCase() + ' ' + path.slice(at)
    const answer = api[key]
    if (answer === undefined) return json(404, { error: 'Not mocked in the screens gallery: ' + key })
    if (answer === pending) return never()
    return answer && typeof answer === 'object' && 'body' in answer ? json(answer.status || 200, answer.body) : json(200, answer)
  }
  undo.push(() => { globalThis.fetch = realFetch })

  const kept = sessionStorage.getItem(STORE_KEY)
  if (onboarding) sessionStorage.setItem(STORE_KEY, JSON.stringify(onboarding))
  else sessionStorage.removeItem(STORE_KEY)
  undo.push(() => { if (kept == null) sessionStorage.removeItem(STORE_KEY); else sessionStorage.setItem(STORE_KEY, kept) })

  const ownOnline = Object.getOwnPropertyDescriptor(navigator, 'onLine')
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
  undo.push(() => { if (ownOnline) Object.defineProperty(navigator, 'onLine', ownOnline); else delete navigator.onLine })

  const ownCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials')
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { get: opts => (credentials.get || never)(opts), create: opts => (credentials.create || never)(opts) },
  })
  undo.push(() => { if (ownCredentials) Object.defineProperty(navigator, 'credentials', ownCredentials); else delete navigator.credentials })

  const ownKey = Object.getOwnPropertyDescriptor(window, 'PublicKeyCredential')
  const has = typeof window.PublicKeyCredential !== 'undefined'
  Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, writable: true, value: webauthn ? (has ? window.PublicKeyCredential : function PublicKeyCredential() {}) : undefined })
  undo.push(() => { if (ownKey) Object.defineProperty(window, 'PublicKeyCredential', ownKey); else delete window.PublicKeyCredential })

  return () => { undo.reverse().forEach(fn => fn()) }
}
