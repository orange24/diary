"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { ScrapElement, ImageScrapElement, PAGE_WIDTH } from "@/types/scrapbook"
import { createEntry, updateEntry, Entry } from "@/services/api"
import { Loader2, X } from "lucide-react"
import { toast } from "sonner"

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null;
  token: string | undefined;
  userId: number | undefined;
}

export function DiaryForm({ onSuccess, initialData, token, userId }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialData?.title || "")
  const [elements, setElements] = useState<ScrapElement[]>(initialData?.layout?.elements || [])
  // Images added via the gallery button never become canvas elements, so they
  // can't be recovered from `elements` on edit — reconstruct them as whatever
  // in initialData.images isn't already represented by an image element.
  const [galleryImages, setGalleryImages] = useState<string[]>(() => {
    const canvasSrcs = new Set(
      (initialData?.layout?.elements || [])
        .filter((el): el is ImageScrapElement => el.type === "image")
        .map((el) => el.src)
    )
    return (initialData?.images || []).filter((src) => !canvasSrcs.has(src))
  })

  useEffect(() => {
    setTitle(initialData?.title || "")
    const nextElements = initialData?.layout?.elements || []
    setElements(nextElements)
    const canvasSrcs = new Set(
      nextElements.filter((el): el is ImageScrapElement => el.type === "image").map((el) => el.src)
    )
    setGalleryImages((initialData?.images || []).filter((src) => !canvasSrcs.has(src)))
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return toast.error("กรุณาเข้าสู่ระบบใหม่");

    setLoading(true)

    try {
      const images = [
        ...elements.filter((el): el is ImageScrapElement => el.type === "image").map((el) => el.src),
        ...galleryImages,
      ]

      const payload = {
        title,
        content: "",
        images,
        created_by: "Watchara",
        layout: { pageWidth: PAGE_WIDTH, elements },
      };

      if (initialData?.id) {
        await updateEntry(initialData.id, payload, token);
      } else {
        await createEntry(payload, token);
      }

      onSuccess();
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">ตกแต่งหน้าบันทึก</label>
        <ScrapbookEditor
          elements={elements}
          onChange={setElements}
          editable
          token={token}
          onGalleryImageAdded={(url) => setGalleryImages((prev) => [...prev, url])}
        />
      </div>

      {galleryImages.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            รูปแกลเลอรี (ดูเต็มๆ ได้ ไม่แสดงในหน้าบันทึก)
          </label>
          <div className="flex flex-wrap gap-3">
            {galleryImages.map((src, index) => (
              <div key={`${src}-${index}`} className="group relative size-24 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  title="ลบรูปนี้ออกจากแกลเลอรี"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-12 text-lg font-bold bg-logo text-logo-foreground shadow-lg shadow-logo/20 hover:bg-logo/90"
        disabled={loading}
      >
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : (initialData ? "อัปเดตไดอารี่" : "บันทึกเรื่องราววันนี้")}
      </Button>
    </form>
  )
}
