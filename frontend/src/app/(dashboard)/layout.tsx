"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { DiaryHeader } from "@/components/diary-header"
import { DiaryTimelineSidebar } from "@/components/diary-timeline-sidebar"
import { DiaryForm } from "@/components/diary-form"
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BookDialogContent } from "@/components/book-dialog-content"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/context/auth-context"
import { useLocale } from "@/context/locale-context"
import { DashboardProvider, useDashboard } from "@/context/dashboard-context"

// Shared by all three dashboard routes (/, /hashtags, /friends): the
// auth guard, header, left timeline sidebar, and the entry create/edit +
// delete-confirmation dialogs — the same dialogs regardless of which route
// triggered them, so they can't live inside any one page.
function DashboardShell({ children }: { children: React.ReactNode }) {
  const { token, handleLogout, user, isLoading } = useAuth()
  const { t } = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const {
    entries,
    feedLayout,
    selectedEntry,
    isModalOpen,
    closeModal,
    handleSuccess,
    existingHashtags,
    deleteId,
    isDeleting,
    confirmDelete,
    cancelDelete,
    gridTopRef,
    timelineTopOffset,
  } = useDashboard()

  useEffect(() => {
    if (!isLoading && !token) {
      router.push("/login")
    }
  }, [token, isLoading, router])

  // Only relevant on the home feed — hashtags/friends don't have a
  // layout toggle, so this reservation never applies to them.
  const showRightLane = pathname === "/" && feedLayout === "single"
  const showRightBar = pathname === "/" && feedLayout === "grid"

  if (isLoading || (!token && typeof window !== "undefined")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-1000">
      <DiaryHeader
        onLogout={handleLogout}
        userName={user?.full_name}
        userAvatar={user?.profile_picture}
        userSlug={user?.slug}
      />

      <main
        className={`mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8 ${showRightBar ? "lg:pr-20" : ""}`}
      >
        <div
          ref={gridTopRef}
          className={`grid grid-cols-1 gap-8 ${
            showRightLane ? "lg:grid-cols-[200px_minmax(0,1fr)_280px]" : "lg:grid-cols-[200px_minmax(0,1fr)]"
          }`}
        >
          {/* Left: year/month timeline */}
          <DiaryTimelineSidebar entries={entries} topOffset={timelineTopOffset} />

          {/* Center: whichever dashboard route is active */}
          <div className="min-w-0">{children}</div>

          {/* Right lane: reserved for future content when the feed is
              capped to a single reading-width column instead of spreading
              full-width — empty skeleton for now. */}
          {showRightLane && (
            <div className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("dashboard.comingSoon")}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Collapsed right rail: what the right lane above becomes once the
          feed spreads full-width again — a thin bar docked to the edge
          instead of taking layout space. Empty skeleton for now. */}
      {showRightBar && (
        <div className="fixed top-16 right-0 bottom-0 z-30 hidden w-14 border-l border-border bg-card/80 backdrop-blur-sm lg:block" />
      )}

      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <BookDialogContent className="sm:max-w-[960px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {selectedEntry ? t("dashboard.editMemoryTitle") : t("dashboard.newEntryTitle")}
            </DialogTitle>
          </DialogHeader>
          <DiaryForm
            key={selectedEntry?.id ?? "new"}
            onSuccess={handleSuccess}
            initialData={selectedEntry}
            token={token}
            userId={user?.userId}
            userName={user?.full_name}
            existingHashtags={existingHashtags}
          />
        </BookDialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent className="rounded-3xl border-primary/10 p-8">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">
              {t("dashboard.deleteEntryTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground text-base">
              {t("dashboard.deleteEntryDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6">
            <AlertDialogCancel className="rounded-2xl border-none bg-muted hover:bg-muted/70 text-muted-foreground px-6 h-12">
              {t("dashboard.deleteEntryCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="rounded-2xl bg-destructive hover:bg-destructive/90 text-destructive-foreground px-6 h-12 shadow-lg shadow-destructive/20"
            >
              {isDeleting ? t("dashboard.deleteEntryDeleting") : t("dashboard.deleteEntryConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  )
}
