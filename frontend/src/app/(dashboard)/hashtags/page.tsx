"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { HashtagExplorer } from "@/components/hashtag-explorer"
import { useAuth } from "@/context/auth-context"
import { useDashboard } from "@/context/dashboard-context"

function HashtagsPageContent() {
  const { token, user } = useAuth()
  const { entries, hasMore, loading, loadMoreEntries, handleEdit, requestDelete } = useDashboard()

  // Deep-linking: /hashtags?tag=foo preselects "foo" — e.g. clicking a
  // #hashtag inside a card elsewhere navigates here with this set. Re-synced
  // whenever the URL's query actually changes (including the nav's plain
  // "/hashtags" link clearing it back to the cloud view, even if this page
  // was already mounted) — but a manual in-page tag pick never touches the
  // URL, so it isn't clobbered by this effect.
  const searchParams = useSearchParams()
  const [selectedTag, setSelectedTag] = useState<string | null>(searchParams.get("tag"))

  useEffect(() => {
    setSelectedTag(searchParams.get("tag"))
  }, [searchParams])

  // The tag cloud needs every entry loaded to build an accurate list, and
  // there's no scroll sentinel here to trigger pagination — keep fetching
  // pages in the background for as long as this route is mounted.
  useEffect(() => {
    if (hasMore && token && !loading) {
      loadMoreEntries()
    }
  }, [hasMore, token, loading, loadMoreEntries])

  return (
    <HashtagExplorer
      entries={entries}
      isLoadingAll={hasMore || loading}
      selectedTag={selectedTag}
      onSelectTag={setSelectedTag}
      onEdit={handleEdit}
      onDelete={requestDelete}
      currentUserId={user?.userId}
    />
  )
}

export default function HashtagsPage() {
  return (
    <Suspense fallback={null}>
      <HashtagsPageContent />
    </Suspense>
  )
}
