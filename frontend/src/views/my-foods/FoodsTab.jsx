import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { t } from '../../lib/i18n.js'
import { settingOf } from '../../lib/nutrition/use-nt-settings.js'
import Chip from '../../ds/Chip.jsx'
import StageSearchField from '../../ds/StageSearchField.jsx'
import FoodsOnline from './FoodsOnline.jsx'
import FoodsYours from './FoodsYours.jsx'

// The Foods tab: the Yours / Open Food Facts chips (the second is gone while Settings > Food
// sources has Open Food Facts off), one search field, and the source's list. The source lives in
// the URL (`&source=off`, replacing); without one the person's default source (Settings > Foods)
// decides.
export default function FoodsTab({ settings, onNew }) {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const offOn = settingOf(settings, 'offEnabled')
  const asked = params.get('source')
  const online = offOn && (asked ? asked === 'off' : settingOf(settings, 'foodsDefaultSource') === 'off')

  const pick = source => {
    const next = new URLSearchParams(params)
    next.set('source', source)
    setParams(next, { replace: true })
  }

  return (
    <>
      <div className="g-mf-chips">
        <Chip pressed={!online} onClick={() => pick('mine')}>{t('Yours')}</Chip>
        {offOn && <Chip pressed={online} onClick={() => pick('off')}>{t('Open Food Facts')}</Chip>}
      </div>
      <StageSearchField query={q} onChange={setQ} label={online ? t('Search Open Food Facts') : t('Search your foods')}
        placeholder={online ? t('Search Open Food Facts') : t('Search your foods')} clearLabel={t('Clear search')} />
      {online
        ? <FoodsOnline q={q} settings={settings} />
        : <FoodsYours q={q} settings={settings} onNew={onNew} onSearchOnline={offOn ? () => pick('off') : undefined} />}
    </>
  )
}
