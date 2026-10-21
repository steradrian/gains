import { Navigate, useLocation } from 'react-router-dom'

/**
 * An old Eat address sent to its new one, keeping the query it came with: `/food/meals?q=soup`
 * with `to="/food/my-foods?tab=meals"` lands on `/food/my-foods?tab=meals&q=soup`. The new
 * address's own parameters win over a clashing old one.
 */
export default function FoodRedirect({ to }) {
  const { search } = useLocation()
  const [path, own = ''] = to.split('?')
  const query = new URLSearchParams(search)
  for (const [key, value] of new URLSearchParams(own)) query.set(key, value)
  const qs = query.toString()
  return <Navigate to={qs ? `${path}?${qs}` : path} replace />
}
