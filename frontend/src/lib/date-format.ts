import { Dictionary, Locale } from "@/locales/types"

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", th: "th-TH" }

export const formatMonthYear = (dateStr: string | undefined, locale: Locale) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString(INTL_LOCALE[locale], { month: "short", year: "numeric" })
}

export const monthKey = (dateStr?: string) => {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })

// Feed-card date label: relative wording for anything posted today ("Just
// now", "5 minutes ago", "3 hours ago" — already time-relative, so no clock
// time appended), "Yesterday" / "N days ago" for the past week and the plain
// "10 September 2026" beyond that both get the clock time appended too.
export const formatEntryDate = (dateStr: string | undefined, dict: Dictionary, locale: Locale) => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs >= 0 && date.toDateString() === now.toDateString()) {
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return dict.date.justNow
    if (diffMinutes < 60) {
      const template = diffMinutes === 1 ? dict.date.minuteAgo : dict.date.minutesAgo
      return template.replace("{n}", String(diffMinutes))
    }
    const diffHours = Math.floor(diffMinutes / 60)
    const template = diffHours === 1 ? dict.date.hourAgo : dict.date.hoursAgo
    return template.replace("{n}", String(diffHours))
  }

  // Calendar-day diff (not raw ms/24h) so e.g. 11pm-yesterday vs 1am-today
  // still count as adjacent calendar days.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000)

  if (diffDays === 1) return `${dict.date.yesterday}, ${formatTime(date)}`
  if (diffDays >= 2 && diffDays <= 7) return `${dict.date.daysAgo.replace("{n}", String(diffDays))}, ${formatTime(date)}`

  const absoluteDate = date.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" })
  return `${absoluteDate}, ${formatTime(date)}`
}
