"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect, RefObject } from "react"
import { useRouter, usePathname } from "next/navigation"
import { toast } from "sonner"
import { getEntries, getEntry, deleteEntry, Entry } from "@/services/api"
import { useAuth } from "@/context/auth-context"
import { useLocale } from "@/context/locale-context"
import { translateError } from "@/lib/i18n"
import { extractHashtags } from "@/lib/hashtags"

// Shared across the three dashboard routes (/, /hashtags, /friends) —
// entries/pagination and the entry create/edit + delete-confirmation dialogs
// are the same underlying state and UI regardless of which route triggered
// them (e.g. editing a card from the Hashtag explorer opens the exact same
// dialog Home's own cards do), so this lives one level up in
// (dashboard)/layout.tsx rather than being duplicated per-route. Friends
// doesn't touch this at all — it has its own independent state.
interface DashboardContextValue {
  entries: Entry[]
  hasMore: boolean
  loading: boolean
  loadMoreEntries: (reset?: boolean) => Promise<void>
  existingHashtags: string[]
  handleEdit: (id: number) => Promise<void>
  requestDelete: (id: number) => void
  openHashtag: (tag: string) => void
  // Home's own grid/single toggle — lives here (not local to the home page)
  // only because the shared layout's right-lane/right-bar reservation needs
  // to react to it; hashtags/friends never read this.
  feedLayout: "grid" | "single"
  setFeedLayout: (layout: "grid" | "single") => void
  selectedEntry: Entry | null
  isModalOpen: boolean
  openNewEntry: () => void
  closeModal: (open: boolean) => void
  handleSuccess: () => void
  deleteId: number | null
  isDeleting: boolean
  confirmDelete: () => Promise<void>
  cancelDelete: () => void
  // Exposed so the shared layout can measure the gap between the grid's top
  // and wherever each page's own content actually starts (only the home
  // page attaches contentStartRef — everywhere else it stays null, which is
  // exactly the pre-routing behavior: the sidebar offset resets to 0 on any
  // non-home view).
  gridTopRef: RefObject<HTMLDivElement | null>
  contentStartRef: RefObject<HTMLDivElement | null>
  timelineTopOffset: number
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider")
  return ctx
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { token, user, handleLogout } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  // In-flight guard. Deliberately a ref, not the `loading` state above:
  // two calls fired from the same render (StrictMode's double-invoked
  // mount effect, or the scroll observer firing twice before a repaint)
  // both read the same stale `loading === false` closure and sail past a
  // state-based check, each appending page 1 again — duplicate entries,
  // duplicate React keys. A ref is read fresh on every call, so the
  // second one returns here.
  const loadingRef = useRef(false)
  const [feedLayout, setFeedLayout] = useState<"grid" | "single">("single")

  const loadMoreEntries = useCallback(
    async (reset = false) => {
      if (!token || loadingRef.current) return
      if (!reset && !hasMore) return

      loadingRef.current = true
      setLoading(true)
      try {
        const currentPage = reset ? 1 : page
        const response = await getEntries(currentPage, 10, token)
        const newEntries = Array.isArray(response) ? response : []

        if (newEntries.length < 10) setHasMore(false)
        else setHasMore(true)

        setEntries((prev) => {
          const currentPrev = Array.isArray(prev) ? prev : []
          return reset ? newEntries : [...currentPrev, ...newEntries]
        })

        setPage(reset ? 2 : page + 1)
      } catch (error: any) {
        console.error("Load error:", error)
        // The session is gone (token expired, or revoked server-side). Drop
        // the dead token on the way out, otherwise every later navigation
        // retries with it and lands back here.
        if (error?.status === 401) {
          handleLogout()
          router.push("/login")
          return
        }
        if (reset) setEntries([])
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [token, page, hasMore, router, handleLogout]
  )

  // Primes the shared feed once a token is available, regardless of which
  // of the three dashboard routes happens to be mounted first — the timeline
  // sidebar (rendered on all of them) depends on this too, not just the
  // home/hashtags pages. Deliberately keyed on `token` alone so it fires
  // once, not on every entries/hasMore change.
  useEffect(() => {
    if (token) loadMoreEntries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const existingHashtags = useMemo(() => {
    const tags = new Set<string>()
    for (const entry of entries) {
      for (const tag of extractHashtags(entry)) tags.add(tag)
    }
    return Array.from(tags)
  }, [entries])

  const openHashtag = useCallback(
    (tag: string) => {
      router.push(`/hashtags?tag=${encodeURIComponent(tag)}`)
    },
    [router]
  )

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openNewEntry = useCallback(() => {
    setSelectedEntry(null)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback((open: boolean) => {
    setIsModalOpen(open)
    if (!open) setSelectedEntry(null)
  }, [])

  const handleEdit = useCallback(
    async (id: number) => {
      if (!token) return
      try {
        const entry = await getEntry(id, token)
        setSelectedEntry(entry)
        setIsModalOpen(true)
      } catch (error) {
        toast.error(translateError(error, t) || t("dashboard.editEntryLoadFailedAlert"))
      }
    },
    [token, t]
  )

  const handleSuccess = useCallback(() => {
    setIsModalOpen(false)
    setSelectedEntry(null)
    setPage(1)
    setHasMore(true)
    loadMoreEntries(true)
  }, [loadMoreEntries])

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDelete = useCallback(async () => {
    if (deleteId === null || !token) return
    setIsDeleting(true)
    try {
      await deleteEntry(deleteId, token)
      setEntries((prev) => prev.filter((e) => e.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      toast.error(translateError(error, t) || t("dashboard.deleteFailedAlert"))
    } finally {
      setIsDeleting(false)
    }
  }, [deleteId, token, t])

  const cancelDelete = useCallback(() => setDeleteId(null), [])

  const gridTopRef = useRef<HTMLDivElement>(null)
  const contentStartRef = useRef<HTMLDivElement>(null)
  const [timelineTopOffset, setTimelineTopOffset] = useState(0)

  useEffect(() => {
    const gridEl = gridTopRef.current
    const contentEl = contentStartRef.current
    if (!gridEl || !contentEl) {
      setTimelineTopOffset(0)
      return
    }
    const measure = () => {
      setTimelineTopOffset(contentEl.getBoundingClientRect().top - gridEl.getBoundingClientRect().top)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(gridEl)
    observer.observe(contentEl)
    return () => observer.disconnect()
  }, [pathname, feedLayout, user?.full_name])

  const value: DashboardContextValue = {
    entries,
    hasMore,
    loading,
    loadMoreEntries,
    existingHashtags,
    handleEdit,
    requestDelete: setDeleteId,
    openHashtag,
    feedLayout,
    setFeedLayout,
    selectedEntry,
    isModalOpen,
    openNewEntry,
    closeModal,
    handleSuccess,
    deleteId,
    isDeleting,
    confirmDelete,
    cancelDelete,
    gridTopRef,
    contentStartRef,
    timelineTopOffset,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}
