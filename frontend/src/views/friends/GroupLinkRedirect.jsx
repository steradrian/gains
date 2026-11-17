import { Navigate, useParams } from 'react-router-dom'

// /g/:code, the address a group link opens (<base>/g/<code>): on to the join page for that code.
// The link works as soon as this app is served, with nothing in front of it to forward it.
export default function GroupLinkRedirect() {
  const { code } = useParams()
  return <Navigate to={'/me/groups/join/' + encodeURIComponent(code)} replace />
}
