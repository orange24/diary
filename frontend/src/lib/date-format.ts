export const formatMonthYear = (dateStr?: string) => {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("th-TH", { month: "short", year: "numeric" })
}

export const monthKey = (dateStr?: string) => {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}`
}
