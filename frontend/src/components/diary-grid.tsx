"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react"
import { Entry } from "@/services/api"
// ✅ 1. Import DOMPurify
import DOMPurify from "isomorphic-dompurify"
import { ScrapbookPreview } from "@/components/scrapbook/ScrapbookPreview"
import { GalleryMosaic } from "@/components/gallery-mosaic"
import { isVideo, getDisplayMedia } from "@/lib/media-utils"
import { linkifyHashtags, hashtagFromClick } from "@/lib/hashtags"

interface DiaryGridProps {
  entries: Entry[]
  onEdit?: (id: number) => void
  onDelete?: (id: number) => void
  onHashtagClick?: (tag: string) => void
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

export function DiaryGrid({ entries, onEdit, onDelete, onHashtagClick }: DiaryGridProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

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
    <div className="grid grid-cols-1 gap-6">
      {entries.map((entry) => {
        const isScrapbook = !!(entry.layout?.elements && entry.layout.elements.length > 0)
        const hasImages = entry.images && entry.images.length > 0

        return (
        <Card
          key={entry.id}
          id={`entry-${entry.id}`}
          className="group relative flex flex-col bg-card overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 scroll-mt-24"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-card-foreground">{entry.title}</CardTitle>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>By {entry.created_by || 'Anonymous'}</span>
              <span>{entry.created_date ? new Date(entry.created_date).toLocaleDateString() : ''}</span>
            </div>

            <CardAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!entry.layout}
                    onClick={() => entry.layout && onEdit?.(entry.id)}
                    title={!entry.layout ? "บันทึกเก่า ไม่รองรับการแก้ไข — กรุณาลบแล้วสร้างใหม่" : undefined}
                  >
                    <Pencil className="size-4" /> แก้ไข
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete?.(entry.id)}
                  >
                    <Trash2 className="size-4" /> ลบ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-4">
            {isScrapbook ? (
              <ScrapbookPreview elements={entry.layout!.elements} onHashtagClick={onHashtagClick} />
            ) : (
              <div
                className="prose dark:prose-invert max-w-none text-muted-foreground"
                onClick={(e) => {
                  const tag = hashtagFromClick(e)
                  if (tag) onHashtagClick?.(tag)
                }}
                dangerouslySetInnerHTML={{ __html: linkifyHashtags(getCleanHtml(entry.content)) }}
              />
            )}

            {hasImages && (
              <GalleryMosaic
                images={entry.images}
                onImageClick={(index) => openLightbox(entry.images, index)}
              />
            )}
          </CardContent>
        </Card>
        )
      })}

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