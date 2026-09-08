"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Pencil, Trash2, X, ChevronLeft, ChevronRight, PlayCircle, Images } from "lucide-react"
import { Entry } from "@/services/api"
// ✅ 1. Import DOMPurify
import DOMPurify from "isomorphic-dompurify"
import { ScrapbookPreview } from "@/components/scrapbook/ScrapbookPreview"

interface DiaryGridProps {
  entries: Entry[]
  onEdit?: (id: number) => void 
  onDelete?: (id: number) => void
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

const isVideo = (path: string) => {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  return videoExtensions.some(ext => path.toLowerCase().endsWith(ext));
};

const getDisplayMedia = (path: string) => {
  if (!path) return "";
  
  if (path.startsWith('http')) {
    if (isVideo(path)) {
      return path.replace(/\/upload\//, "/upload/so_auto/").replace(/\.[^/.]+$/, ".jpg");
    }
    return path;
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_STORED_URL || "http://localhost:9090";
  const fullPath = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;

  if (isVideo(path)) {
    const fileName = path.split('/').pop();
    return `${baseUrl}/uploads/thumb-${fileName}.jpg`;
  }

  return fullPath;
};

export function DiaryGrid({ entries, onEdit, onDelete }: DiaryGridProps) {
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
          {isScrapbook && hasImages && (
            <button
              type="button"
              onClick={() => openLightbox(entry.images, 0)}
              title={`ดูรูปภาพทั้งหมด (${entry.images.length})`}
              className="absolute top-3 right-3 z-10 flex items-center gap-1 rounded-full bg-background/80 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
            >
              <Images className="size-3.5" />
              {entry.images.length}
            </button>
          )}

          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-bold text-card-foreground">{entry.title}</CardTitle>
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>By {entry.created_by || 'Anonymous'}</span>
              <span>{entry.created_date ? new Date(entry.created_date).toLocaleDateString() : ''}</span>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isScrapbook ? (
              <ScrapbookPreview elements={entry.layout!.elements} />
            ) : (
              <div
                className="prose dark:prose-invert max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: getCleanHtml(entry.content) }}
              />
            )}

            {hasImages && (
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
                {entry.images.map((path, index) => (
                  <div
                    key={index}
                    className="relative flex-none w-72 h-48 rounded-2xl overflow-hidden border border-border cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-primary hover:z-20 m-[2px]"
                    onClick={() => openLightbox(entry.images, index)}
                  >
                    <img
                      src={getDisplayMedia(path)}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                      alt="Media thumbnail"
                      loading="lazy"
                    />
                    {isVideo(path) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                        <PlayCircle className="text-white w-12 h-12 opacity-90 drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2 pt-2 pb-4 px-6 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              disabled={!entry.layout}
              title={!entry.layout ? "บันทึกเก่า ไม่รองรับการแก้ไข — กรุณาลบแล้วสร้างใหม่" : undefined}
              onClick={() => entry.layout && onEdit?.(entry.id)}
              className="text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pencil className="h-4 w-4 mr-1.5" /> แก้ไข
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete?.(entry.id)} className="text-destructive hover:bg-destructive/10 rounded-lg">
              <Trash2 className="h-4 w-4 mr-1.5" /> ลบ
            </Button>
          </CardFooter>
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