export const formatMonthYear = (dateStr?: string) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

export const monthKey = (dateStr?: string) => {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}

// Feed-card date label: relative wording for anything posted today ("Just
// now", "5 minutes ago", "3 hours ago"), a plain "10 September 2026"
// otherwise.
export const formatEntryDate = (dateStr?: string) => {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs >= 0 && date.toDateString() === now.toDateString()) {
    const diffMinutes = Math.floor(diffMs / 60000)
    if (diffMinutes < 1) return "Just now"
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`
    const diffHours = Math.floor(diffMinutes / 60)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
  }

  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}
