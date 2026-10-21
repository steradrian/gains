import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import Modals from '../../components/Modals.jsx'
import Toast from '../../components/Toast.jsx'
import { setNav } from '../../lib/nav.js'
import { applySheetKeyboard } from '../../lib/sheet-keyboard.js'
import { useUI } from '../../store/useUI.js'
import AddDevice, { ADD_DEVICE_PATH } from '../../views/AddDevice.jsx'
import { installMocks } from './mock-env.js'
import { screenAreas, screenById } from './registry.js'
import './dev-screens.css'

// Every registered screen state, at phone width, with mocked data and no network: #/dev/screens for
// the index, #/dev/screens/S0.2 for one state (App.jsx; production builds leave it all out). The
// screens in the frames are the real components; mock-env.js replaces what they call, and each
// frame has a router of its own, so a tap that navigates stays inside it. Sample copy of the
// gallery itself is English and not translated, like the kit's.
const ROOT = '#/dev/screens'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Lets code outside the router (lib/nav.js, used by the sheets) navigate inside the frame.
function NavBinder() {
  const navigate = useNavigate()
  useLayoutEffect(() => { setNav(navigate) }, [navigate])
  return null
}

// What a state's `play` has to bring a screen to a state only input reaches.
function tools(host) {
  const find = (selector, text) => [...host.querySelectorAll(selector)].find(el => el.textContent === text)
  const field = label => {
    const wrapped = [...host.querySelectorAll('.g-tfield')].find(f => f.querySelector('.g-tfield-label')?.textContent === label)?.querySelector('input')
    return wrapped || host.querySelector(`input[aria-label="${label}"]`)
  }
  const tools = {
    wait: ms => sleep(ms),
    // The thing to tap may not be there yet: the screen is still answering the tap before.
    click: async text => {
      let el = find('button, a', text)
      for (let waited = 0; !el && waited < 2000; waited += 40) { await sleep(40); el = find('button, a', text) }
      if (!el) throw new Error(`Screens gallery: nothing to tap labelled "${text}"`)
      el.click()
      await sleep(60)
    },
    type: async (label, value) => {
      const input = field(label)
      if (!input) throw new Error(`Screens gallery: no field labelled "${label}"`)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(30)
    },
    // The form on top: the one in the open drawer, else the screen's own.
    submit: async () => {
      const forms = host.querySelectorAll('form')
      forms[forms.length - 1].dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await sleep(120)
    },
  }
  return tools
}

/** One state in its frame; `onPlayed` is called when its taps have run (or failed, with the error). */
export function Stage({ entry, onPlayed }) {
  const [ready, setReady] = useState(false)
  const frame = useRef(null)
  useLayoutEffect(() => {
    // Drawers and the toast live in the app's store, not in the frame: one left up by the state
    // before would still be there.
    const clear = () => {
      applySheetKeyboard(window)   // a state's simulated keyboard (states/sheet-panels.jsx) goes with it
      useUI.getState().closeAll()
      useUI.getState().resumeToast()
      useUI.setState({ toastMsg: '', toastAction: null })
    }
    clear()
    const undo = installMocks(entry.mock)
    setReady(true)
    return () => { setReady(false); clear(); undo() }
  }, [entry])
  useEffect(() => {
    if (!ready) return
    let gone = false
    ;(async () => {
      try {
        await sleep(40)
        if (entry.play && !gone) await entry.play(tools(frame.current))
        onPlayed?.(null)
      } catch (e) { onPlayed?.(e) }
    })()
    return () => { gone = true }
  }, [ready, entry])
  const entries = entry.path && entry.path !== '/' ? ['/', entry.path] : ['/']
  return (
    <div className="dsg-frame" ref={frame}>
      {ready && (
        <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
          <NavBinder />
          <Routes>
            <Route path={ADD_DEVICE_PATH} element={<AddDevice />} />
            <Route path="*" element={entry.render()} />
          </Routes>
          <Modals />
          <Toast />
        </MemoryRouter>
      )}
    </div>
  )
}

function Index() {
  return (
    <>
      <h1>Screens</h1>
      <p className="dsg-note">Every screen state, rendered for real at phone width with mocked data. Each opens on its own at {ROOT}/&lt;id&gt;.</p>
      {screenAreas().map(area => (
        <section key={area.name} className="dsg-area">
          <h2>{area.name}</h2>
          <ul>
            {area.entries.map(e => (
              <li key={e.id}>
                <a href={`${ROOT}/${encodeURIComponent(e.id)}`}><b>{e.id}</b> {e.title}</a>
                {e.note && <span> — {e.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

export default function DevScreens() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const id = decodeURIComponent(hash.slice(ROOT.length + 1))
  const entry = id ? screenById(id) : null
  return (
    <div className="dsg">
      <nav className="dsg-nav"><a href={ROOT}>All screens</a> · <a href="#/dev/kit">Kit</a></nav>
      {entry ? (
        <>
          <h1><b>{entry.id}</b> {entry.title}</h1>
          {entry.note && <p className="dsg-note">{entry.note}</p>}
          <Stage key={entry.id} entry={entry} />
        </>
      ) : id ? <p className="dsg-note">There is no state "{id}". <a href={ROOT}>See the index.</a></p> : <Index />}
    </div>
  )
}

// Every file in ./states registers its screens here: a PR that adds screens adds one.
import.meta.glob('./states/*.jsx', { eager: true })
