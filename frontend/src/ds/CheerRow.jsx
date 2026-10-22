import MemberAvatar from './MemberAvatar.jsx'

// One cheer on Cheers for you (board Fr8Cheers): who cheered, in their colour, what they cheered,
// a line of detail and when. It is plain information, not a button. The caller builds every
// string ("Mara cheered your Push A", "2 h ago") through t(); the initial is decoration.
export default function CheerRow({ initial, tone = 'glass', text, detail, when }) {
  return (
    <li className="g-crow">
      <MemberAvatar initial={initial} tone={tone} />
      <span className="g-crow-body">
        <b>{text}</b>
        {detail && <span>{detail}</span>}
        {when && <small>{when}</small>}
      </span>
    </li>
  )
}
