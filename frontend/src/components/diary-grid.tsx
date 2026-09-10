"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, MoreVertical, Lock, Users, Globe, User } from "lucide-react"
import { Entry, EntryAudience } from "@/services/api"
// ✅ 1. Import DOMPurify
import DOMPurify from "isomorphic-dompurify"
import { ScrapbookPreview } from "@/components/scrapbook/ScrapbookPreview"
import { GalleryMosaic } from "@/components/gallery-mosaic"
import { isVideo, getDisplayMedia } from "@/lib/media-utils"
import { linkifyHashtags, hashtagFromClick } from "@/lib/hashtags"
import { linkifyMentions } from "@/lib/mentions"

interface DiaryGridProps {
  entries: Entry[]
  // Needed to tell a friend's entry (merged into this same feed because it
  // tags this user) apart from the viewer's own — see the pink card
  // styling and the edit/delete menu below.
  currentUserId?: number
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  onHashtagClick?: (tag: string) => void
}

const AUDIENCE_META: Record<EntryAudience, { label: string; icon: typeof Lock }> = {
  private: { label: "Only me", icon: Lock },
  friend: { label: "Friends", icon: Users },
  public: { label: "Public", icon: Globe },
}

// ✅ 2. สร้าง Helper Function สำหรับกรอง HTML (วางไว้นอก Component)
const getCleanHtml = (html: string) => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 
      'h1', 'h2', 'h3', 'code', 'pre', 'span', 'blockquote'
    ],
    ALLOWED_ATTR: ['href', 'target', 'class']
  });
};

export function DiaryGrid({ entries, currentUserId, onEdit, onDelete, onHashtagClick }: DiaryGridProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // Clicking a card's content pops it open here so the (often scaled-down,
  // masonry-cramped) preview can be read at full size.
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)

  const openLightbox = (images: string[], index: number) => {
    setCurrentImages(images)
    setCurrentIndex(index)
    setIsOpen(true)
  }

  const closeLightbox = useCallback(() => setIsOpen(false), [])

  const nextImage = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % currentImages.length)
  }, [currentImages.length])

  const prevImage = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length)
  }, [currentImages.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      switch (e.key) {
        case "ArrowRight": nextImage(); break;
        case "ArrowLeft": prevImage(); break;
        case "Escape": closeLightbox(); break;
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    if (isOpen) document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [isOpen, nextImage, prevImage, closeLightbox])

  return (
    // True masonry, not a row-based grid: a CSS multi-column layout packs
    // each card into whichever column has room next, so a short card is
    // immediately followed by the next card in that same column instead of
    // leaving a gap until the next row starts (a CSS Grid's row tracks all
    // share one height, which is what caused that gap). `break-inside-avoid`
    // on each card stops it from being split across a column boundary; the
    // vertical gap between stacked cards comes from each card's own
    // margin-bottom since column-gap only affects the horizontal gutters.
    <div className="columns-1 gap-6 sm:columns-2 xl:columns-3">
      {entries.map((entry) => {
        const isScrapbook = !!(entry.layout?.elements && entry.layout.elements.length > 0)
        const hasImages = entry.images && entry.images.length > 0
        // A friend's entry merged into this feed (because it tags this
        // user) — never own unless currentUserId isn't known yet.
        const isOwn = currentUserId === undefined || entry.user_id === currentUserId

        return (
        <Card
          key={entry.id}
          id={`entry-${entry.id}`}
          className={`group relative mb-6 block break-inside-avoid gap-0 overflow-hidden border-none p-0 shadow-sm transition-all duration-300 hover:shadow-md scroll-mt-24 ${
            isOwn ? "bg-card" : "bg-[#fdf2f8]"
          }`}
        >
          {/* System metadata (author, audience, the 3-dot menu) stays out of
              the way by default so the card reads as pure content — it only
              surfaces on hover. The date is the one exception and stays
              visible always (its own small badge, see below). */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 bg-gradient-to-b from-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <div className="flex items-center gap-2">
              <Avatar className="size-8 border-2 border-white/80">
                {entry.created_by_avatar && (
                  <AvatarImage src={entry.created_by_avatar} alt={entry.created_by || "Profile"} />
                )}
                <AvatarFallback className="bg-white/20 text-white">
                  <User className="size-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-bold text-white">{entry.created_by || 'Anonymous'}</span>
                {entry.audience && (() => {
                  const { label, icon: Icon } = AUDIENCE_META[entry.audience]
                  return (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-white/80" title={label}>
                      <Icon className="size-3" /> {label}
                    </span>
                  )
                })()}
              </div>
            </div>

            {isOwn && (
              <div className="pointer-events-auto">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-white hover:bg-white/20 hover:text-white"
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={!entry.layout}
                      onClick={() => entry.layout && onEdit?.(entry.id)}
                      title={!entry.layout ? "This is an old entry and can't be edited — please delete it and create a new one" : undefined}
                    >
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDelete?.(entry.id)}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Shifted left of right-2 so it clears the 3-dot menu button
              (size-8, sitting in the overlay's own right-aligned p-3
              padding) instead of overlapping it on hover. */}
          <div className="pointer-events-none absolute right-14 top-2 z-20 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
            {entry.created_date ? new Date(entry.created_date).toLocaleDateString() : ''}
          </div>

          {/* Opens the full-size viewer below. Hashtag clicks (in either
              branch) stopPropagation once handled, so tapping a tag
              navigates instead of also popping the viewer open. */}
          <div className="cursor-pointer" onClick={() => setViewingEntry(entry)}>
            {isScrapbook ? (
              <ScrapbookPreview elements={entry.layout!.elements} onHashtagClick={onHashtagClick} />
            ) : (
              <div
                className="prose dark:prose-invert max-w-none p-4 text-muted-foreground"
                onClick={(e) => {
                  const tag = hashtagFromClick(e)
                  if (tag) {
                    e.stopPropagation()
                    onHashtagClick?.(tag)
                  }
                }}
                dangerouslySetInnerHTML={{ __html: linkifyMentions(linkifyHashtags(getCleanHtml(entry.content))) }}
              />
            )}
          </div>

          {hasImages && (
            <GalleryMosaic
              images={entry.images}
              onImageClick={(index) => openLightbox(entry.images, index)}
            />
          )}
        </Card>
        )
      })}

      {/* --- Full-content viewer --- */}
      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {viewingEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {viewingEntry.created_by_avatar && (
                      <AvatarImage src={viewingEntry.created_by_avatar} alt={viewingEntry.created_by || "Profile"} />
                    )}
                    <AvatarFallback>
                      <User className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left leading-tight">
                    <DialogTitle className="text-base">{viewingEntry.created_by || "Anonymous"}</DialogTitle>
                    <span className="text-xs text-muted-foreground">
                      {viewingEntry.created_date ? new Date(viewingEntry.created_date).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              {viewingEntry.layout?.elements && viewingEntry.layout.elements.length > 0 ? (
                <ScrapbookPreview
                  elements={viewingEntry.layout.elements}
                  onHashtagClick={(tag) => {
                    setViewingEntry(null)
                    onHashtagClick?.(tag)
                  }}
                />
              ) : (
                <div
                  className="prose dark:prose-invert max-w-none text-muted-foreground"
                  onClick={(e) => {
                    const tag = hashtagFromClick(e)
                    if (tag) {
                      setViewingEntry(null)
                      onHashtagClick?.(tag)
                    }
                  }}
                  dangerouslySetInnerHTML={{
                    __html: linkifyMentions(linkifyHashtags(getCleanHtml(viewingEntry.content))),
                  }}
                />
              )}

              {viewingEntry.images && viewingEntry.images.length > 0 && (
                <GalleryMosaic
                  images={viewingEntry.images}
                  onImageClick={(index) => openLightbox(viewingEntry.images, index)}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --- Lightbox UI --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300"
          onClick={closeLightbox} // คลิกพื้นที่ว่างเพื่อปิด
        >
          <button 
            onClick={closeLightbox}
            className="absolute top-8 right-8 text-white/70 hover:text-white z-[110] transition-colors"
          >
            <X className="h-10 w-10" />
            <span className="text-[10px] block text-center mt-1">ESC</span>
          </button>

          {currentImages.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-6 text-white p-3 hover:bg-white/10 rounded-full transition-all group"
            >
              <ChevronLeft className="h-12 w-12 group-active:scale-90" />
            </button>
          )}

          <div 
            className="relative max-w-6xl max-h-[85vh] flex items-center justify-center select-none"
            onClick={(e) => e.stopPropagation()} // ป้องกันการคลิกรูปแล้วปิด
          >
            {isVideo(currentImages[currentIndex]) ? (
              <video 
                src={getDisplayMedia(currentImages[currentIndex])}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={getDisplayMedia(currentImages[currentIndex])}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                alt="Full size"
              />
            )}
            
            {/* ตัวเลขบอกลำดับรูป */}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono">
              {currentIndex + 1} / {currentImages.length}
            </div>
          </div>

          {currentImages.length > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-6 text-white p-3 hover:bg-white/10 rounded-full transition-all group"
            >
              <ChevronRight className="h-12 w-12 group-active:scale-90" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}