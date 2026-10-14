import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { streakWeeks } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { BRAND } from '../brand.js'
import { calendarSheet, starterPlanSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import RootHeader from '../components/RootHeader.jsx'
import TodayCard from '../components/TodayCard.jsx'
import DaySessionCard from '../components/DaySessionCard.jsx'
import DiaryDateStrip from '../components/DiaryDateStrip.jsx'
import CaloriesCard from '../components/CaloriesCard.jsx'
import WaterCard from '../components/WaterCard.jsx'
import MealsCard from '../components/MealsCard.jsx'
import WeightCard from '../components/WeightCard.jsx'
import { weekTally } from '../lib/queue.js'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { useDiaryTarget } from '../lib/nutrition/selection.js'
import { useDiaryDay } from '../lib/nutrition/use-diary-day.js'
import { refreshHubStatus } from '../lib/nutrition/sync.js'
import { useScrolledPast } from '../lib/use-scrolled-past.js'

// The sticky date strip's height: the calories card counts as gone once it passes under it.
const STRIP_PX = 52

// Home is the day (ia-proposal §2): a date strip, the day's session, then the diary (energy and
// macros, water, meals with their activity), weight and the week. On a day other than today
// every card shows that day and logs go to it.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const { date } = useDiaryTarget(null)
  const day = useDiaryDay(date)
  const isToday = date === todayISO()
  const kcalRef = useRef(null)
  const kcalGone = useScrolledPast(kcalRef, STRIP_PX)

  useEffect(() => { if (day.on) refreshHubStatus() }, [day.on])

  const { done: doneThisWeek, planned: plannedPerWeek } = weekTally(S, todayISO())

  return <div className="home-diary">
    <RootHeader title={user ? t('Hi {0}', user.name) : BRAND.name}
      sub={new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })} />

    <DiaryDateStrip date={date} left={day.on && kcalGone && day.status === 'ready' ? day.left : null} />

    {isToday ? <TodayCard /> : <DaySessionCard date={date} />}

    {/* Jump to the gym check-in cards (QR membership codes). Shown here as a quick tap on
        arrival at the gym; folds away per user via the "Gym check-in" switch in Settings. */}
    {isToday && S.checkIn !== false && (
      <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => nav('/train/checkin'))}>
        <div className="row between">
          <div className="row" style={{ gap: 9 }}>
            <span className="lrow-i" style={{ background: 'var(--blue)' }}><Icon name="qr" /></span>
            <div>
              <div className="lbl2">{t('At the gym')}</div>
              <div className="ttl">{t('Check in')}</div>
            </div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      </div>
    )}

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="calendar" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going, or grab a ready-made starter plan.')}</div>
        <Button variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/train/routines')}>{t('Build my own plan')}</Button>
      </div>
    )}

    {day.on && <>
      <CaloriesCard ref={kcalRef} day={day} />
      <WaterCard date={date} water={day.water} ready={day.status === 'ready'} />
      <MealsCard date={date} day={day} />
    </>}

    {S.showWeightCard !== false && <WeightCard date={date} />}

    <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => calendarSheet())}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="calendarCheck" style={{ color: 'var(--orange-ink)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{doneThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {tn('{0} workout total', '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
