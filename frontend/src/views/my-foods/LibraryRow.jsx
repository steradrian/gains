import Icon from '../../components/Icon.jsx'
import Act from '../../ds/Act.jsx'
import Tag from '../../ds/Tag.jsx'

// One row of a My foods list (boards Ea4MyFoods, Ea4Online, Ea4Saved, Ea4Recipes): a name, the line
// under it, an optional Online tag, and a chevron. `favourite` puts a star before the name; the
// star is decoration (the list's heading says Favourites).
export default function LibraryRow({ title, sub, favourite, tag, onClick }) {
  return (
    <Act onClick={onClick} className="g-mf-row">
      <span className="g-mf-body">
        <b>{favourite && <Icon name="starFill" className="g-icon g-mf-star" />}{title}</b>
        {sub && <span>{sub}</span>}
      </span>
      {tag && <Tag tone="glass">{tag}</Tag>}
      <Icon name="chevronRight" className="g-icon g-mf-chev" />
    </Act>
  )
}
