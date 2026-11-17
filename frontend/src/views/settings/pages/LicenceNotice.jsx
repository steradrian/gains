import { openExternal } from '../../../components/CustomMedia.jsx'
import SettingRow from '../SettingRow.jsx'

// A third-party notice on Licences: its heading, its legal text, and the links the text names as
// rows under it (a link is a row on the stage, never a link inside the text). The legal wording is
// not translated, so `children` is the text as NOTICE.md has it.
export default function LicenceNotice({ title, children, links = [] }) {
  return (
    <div className="g-glist g-glass">
      <div className="set-lic">
        <b>{title}</b>
        <p>{children}</p>
      </div>
      {links.map(l => <SettingRow key={l.url} icon="link" title={l.label} onClick={() => openExternal(l.url)} />)}
    </div>
  )
}
