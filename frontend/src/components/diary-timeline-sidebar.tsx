"use client"

import { Entry } from "@/services/api"
import { formatMonthYear, monthKey } from "@/lib/date-format"
import { useLocale } from "@/context/locale-context"

interface DiaryTimelineSidebarProps {
  entries: Entry[]
  // Pixels to push the sidebar's initial (pre-scroll) position down by, so
  // its top lines up with where the composer/feed actually starts instead
  // of the "Welcome back" greeting above it. Doesn't affect the sticky
  // pinned position once scrolled past it.
  topOffset?: number
}

interface MonthGroup {
  key: string
  label: string
  anchorId: string
  count: number
}

// Left-column timeline: one entry per month, anchored to that month's first
// (newest) entry in the feed so clicking scrolls the center column to it.
export function DiaryTimelineSidebar({ entries, topOffset = 0 }: DiaryTimelineSidebarProps) {
  const { locale } = useLocale()
  const groups: MonthGroup[] = []
  for (const entry of entries) {
    const key = monthKey(entry.created_date)
    const existing = groups.find((g) => g.key === key)
    if (existing) {
      existing.count += 1
    } else {
      groups.push({ key, label: formatMonthYear(entry.created_date, locale), anchorId: `entry-${entry.id}`, count: 1 })
    }
  }

  // Never render nothing: the parent grid places its children into tracks
  // by DOM order (200px sidebar, flexible center, optional right lane) — a
  // sidebar that disappears entirely for a brand-new account with no
  // entries yet would shift the center feed into the 200px sidebar track
  // instead, squeezing the whole page into a sliver. An empty placeholder
  // keeps this component's slot in the grid without showing anything.
  if (groups.length === 0) return <div aria-hidden className="hidden lg:block" />


  const scrollToAnchor = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <nav
      className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block"
      style={{ marginTop: topOffset }}
    >
      <div className="relative pl-6">
        <div className="absolute left-[3px] top-1 bottom-1 w-px bg-border" aria-hidden />
        <ul className="space-y-4">
          {groups.map((group) => (
            <li key={group.key} className="relative">
              <span
                className="absolute -left-6 top-1.5 size-2 rounded-full bg-logo ring-4 ring-background"
                aria-hidden
              />
              <button
                type="button"
                onClick={() => scrollToAnchor(group.anchorId)}
                className="text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-logo"
              >
                {group.label}
                <span className="ml-1.5 text-xs text-muted-foreground/60">({group.count})</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
