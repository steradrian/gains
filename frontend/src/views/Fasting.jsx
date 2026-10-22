import FastingScreen from './fasting/FastingScreen.jsx'
import { useFastingPage } from './fasting/use-fasting-page.js'

// Fasting (a row of Eat, `/food/fasting`): start and end a fast on a plan, the time fasted and
// left, the insights and the history. The page's reading and doing is use-fasting-page.js; what
// it draws is fasting/FastingScreen.jsx, which the screens gallery renders with a frozen clock.
export default function Fasting() {
  return <FastingScreen {...useFastingPage()} />
}
