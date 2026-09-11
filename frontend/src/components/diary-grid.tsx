"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { ScrapElement } from "@/types/scrapbook"
import { formatEntryDate } from "@/lib/date-format"
import { useLocale } from "@/context/locale-context"
import Link from "next/link"

interface DiaryGridProps {
  entries: Entry[]
  // Needed to tell a friend's entry (merged into this same feed because it
  // tags this user) apart from the viewer's own — see the pink card
  // styling and the edit/delete menu below.
  currentUserId?: number
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  onHashtagClick?: (tag: string) => void
  // "grid" (default) packs entries into the responsive masonry columns
  // below; "single" forces one long column regardless of screen width.
  layout?: "grid" | "single"
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

// True once any text box actually has content — an entry with only
// image/sticker elements (no writing at all) gets shown as a plain photo
// filling the whole card instead of the scrapbook page it's placed on.
const hasVisibleText = (elements: ScrapElement[]) =>
  elements.some(
    (el) => el.type === "text" && el.text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0
  )

// Column count at the same breakpoints the old `columns-1 sm:columns-2
// xl:columns-3` CSS used — tracked in JS now so entries can be assigned to
// columns in reading order (see below) instead of CSS multi-column's
// column-major fill, which stacked the newest entries in column 1 alone.
function useColumnCount() {
  const [columns, setColumns] = useState(1)

  useEffect(() => {
    const mqSm = window.matchMedia("(min-width: 640px)")
    const mqXl = window.matchMedia("(min-width: 1280px)")
    const update = () => setColumns(mqXl.matches ? 3 : mqSm.matches ? 2 : 1)
    update()
    mqSm.addEventListener("change", update)
    mqXl.addEventListener("change", update)
    return () => {
      mqSm.removeEventListener("change", update)
      mqXl.removeEventListener("change", update)
    }
  }, [])

  return columns
}

export function DiaryGrid({ entries, currentUserId, onEdit, onDelete, onHashtagClick, layout = "grid" }: DiaryGridProps) {
  const { locale, t } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  // Clicking a card's content pops it open here so the (often scaled-down,
  // masonry-cramped) preview can be read at full size.
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null)

  const responsiveColumnCount = useColumnCount()
  // "single" layout always forces one long column, ignoring the screen-width
  // breakpoints "grid" layout otherwise responds to.
  const columnCount = layout === "single" ? 1 : responsiveColumnCount
  // Round-robin entries across columns (entry 0 → col 0, entry 1 → col 1,
  // ...) so the newest entries read left-to-right across the top before
  // wrapping down, then each column stacks independently — true masonry
  // packing (no gaps under a short card) without CSS multi-column's
  // column-major fill order.
  const columnEntries = useMemo(() => {
    const cols: Entry[][] = Array.from({ length: columnCount }, () => [])
    entries.forEach((entry, i) => cols[i % columnCount].push(entry))
    return cols
  }, [entries, columnCount])

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

  const renderEntry = (entry: Entry) => {
        const elements = entry.layout?.elements ?? []
        const isScrapbook = elements.length > 0
        const canvasImageElements = elements.filter((el) => el.type === "image")
        const hasImages = !!(entry.images && entry.images.length > 0)
        // No writing anywhere — not on the canvas, and not in the legacy
        // plain-text field either — so there's nothing for a text-oriented
        // view to show. Canvas images (stickers/photos placed on the page)
        // take priority when both exist; otherwise fall back to whatever
        // was uploaded straight to the gallery (e.g. a blank page with
        // just a gallery photo added, no canvas elements at all).
        const legacyTextContent = entry.content?.replace(/<[^>]*>/g, "").trim() ?? ""
        const hasWrittenText = hasVisibleText(elements) || legacyTextContent.length > 0
        const imageOnlySrcs = canvasImageElements.length > 0 ? canvasImageElements.map((el) => el.src) : entry.images
        const isImageOnly = !hasWrittenText && (canvasImageElements.length > 0 || hasImages)
        // A friend's entry merged into this feed (because it tags this
        // user) — never own unless currentUserId isn't known yet.
        const isOwn = currentUserId === undefined || entry.user_id === currentUserId

        return (
        <div key={entry.id}>
          {/* Date now sits above the card (not overlaid on its content) —
              the one piece of metadata that stays visible always.
              Everything else (author, audience, the 3-dot menu) stays out
              of the card's way by default so it reads as pure content,
              surfacing on the right only on hover. */}
          <div className="mb-1.5 flex items-center gap-1 text-[14px] text-[#9b9b9b]">
            {entry.audience === "public" && <Globe className="size-3.5 text-blue-500" />}
            {entry.audience === "friend" && <Users className="size-3.5 text-blue-300" />}
            {entry.audience === "private" && <Lock className="size-3.5 text-pink-300" />}
            {formatEntryDate(entry.created_date, t, locale)}
          </div>

          <Card
            id={`entry-${entry.id}`}
            className={`group relative block gap-0 overflow-hidden p-0 shadow-sm transition-all duration-300 hover:shadow-md scroll-mt-24 ${
              isOwn ? "bg-card" : "bg-[#fdf2f8]"
            } ${
              entry.audience === "public"
                ? "border-t-4 border-t-blue-500"
                : entry.audience === "friend"
                  ? "border-t-4 border-t-blue-300"
                  : "border-t-4 border-t-gray-300"
            }`}
          >
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-3 bg-gradient-to-b from-black/60 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {(() => {
              const authorContent = (
                <>
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
                </>
              )
              // Links to the author's public profile page — only possible
              // once the feed actually knows their slug.
              return entry.created_by_slug ? (
                <Link href={`/${entry.created_by_slug}`} className="pointer-events-auto flex items-center gap-2 hover:opacity-90">
                  {authorContent}
                </Link>
              ) : (
                <div className="flex items-center gap-2">{authorContent}</div>
              )
            })()}

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

          {isImageOnly ? (
            // No writing anywhere on this entry — show the photo(s)
            // themselves filling the card edge-to-edge instead of an empty
            // scrapbook page (or a blank content block sitting above the
            // gallery). Clicking opens the same full-screen lightbox as
            // gallery photos, not the content viewer — there's no text for
            // that dialog to help read.
            imageOnlySrcs.length === 1 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageOnlySrcs[0]}
                alt=""
                className="block w-full h-auto cursor-pointer"
                onClick={() => openLightbox(imageOnlySrcs, 0)}
              />
            ) : (
              <GalleryMosaic
                images={imageOnlySrcs}
                onImageClick={(index) => openLightbox(imageOnlySrcs, index)}
              />
            )
          ) : (
            /* Opens the full-size viewer below. Hashtag clicks (in either
               branch) stopPropagation once handled, so tapping a tag
               navigates instead of also popping the viewer open. */
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
          )}

          {/* Canvas images already rendered above as the primary content
              when isImageOnly, so only show the separate gallery block when
              it's carrying photos distinct from what's already shown. */}
          {!isImageOnly && hasImages && (
            <GalleryMosaic
              images={entry.images}
              onImageClick={(index) => openLightbox(entry.images, index)}
            />
          )}
          </Card>
        </div>
        )
  }

  return (
    <div>
      {/* Each column is an independent flex stack (renderEntry's items,
          assigned round-robin above) — true masonry packing since a short
          card is immediately followed by the next card in that same
          column, with no shared row height to leave a gap under it. */}
      <div className="flex items-start gap-6">
        {columnEntries.map((colEntries, colIndex) => (
          <div key={colIndex} className="flex min-w-0 flex-1 flex-col gap-6">
            {colEntries.map(renderEntry)}
          </div>
        ))}
      </div>

      {/* --- Full-content viewer --- */}
      <Dialog open={!!viewingEntry} onOpenChange={(open) => !open && setViewingEntry(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {viewingEntry && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {viewingEntry.created_by_slug ? (
                    <Link href={`/${viewingEntry.created_by_slug}`} onClick={() => setViewingEntry(null)} className="hover:opacity-80">
                      <Avatar className="size-10">
                        {viewingEntry.created_by_avatar && (
                          <AvatarImage src={viewingEntry.created_by_avatar} alt={viewingEntry.created_by || "Profile"} />
                        )}
                        <AvatarFallback>
                          <User className="size-5" />
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : (
                    <Avatar className="size-10">
                      {viewingEntry.created_by_avatar && (
                        <AvatarImage src={viewingEntry.created_by_avatar} alt={viewingEntry.created_by || "Profile"} />
                      )}
                      <AvatarFallback>
                        <User className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col text-left leading-tight">
                    {viewingEntry.created_by_slug ? (
                      <Link href={`/${viewingEntry.created_by_slug}`} onClick={() => setViewingEntry(null)} className="hover:underline">
                        <DialogTitle className="text-base">{viewingEntry.created_by || "Anonymous"}</DialogTitle>
                      </Link>
                    ) : (
                      <DialogTitle className="text-base">{viewingEntry.created_by || "Anonymous"}</DialogTitle>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatEntryDate(viewingEntry.created_date, t, locale)}
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