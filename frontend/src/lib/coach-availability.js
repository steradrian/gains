// The one switch for the AI Coach's "coming soon" state. While it is true every Coach entry point
// (the /train/coach routes, the Train card, the Plan banner and menu, search, "Ask Coach to design
// one", the onboarding offer) shows the coming-soon page or hides itself; the Coach code behind
// them is untouched. The owner flips this to false after the security and abuse check, before
// inviting friends. The admin's provider card (views/AdminCoach.jsx) does not read it.
export const COACH_COMING_SOON = true
