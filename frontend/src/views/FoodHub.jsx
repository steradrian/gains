import EatScreen from './eat/EatScreen.jsx'
import { useEat } from './eat/use-eat.js'

// Eat, the third tab (PR-04): on the stage, a full-screen view that draws its own header
// (ui-guards PAGE_EXEMPT). Its data is useEat's; EatScreen draws it. The diary of a day lives on
// Today and on the Day page (`/food/day/:date`), not here.
export default function FoodHub() {
  return <EatScreen {...useEat()} />
}
