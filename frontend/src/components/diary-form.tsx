"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { ScrapElement, ImageScrapElement, PAGE_WIDTH, createPlaceholderTextElement } from "@/types/scrapbook"
import { createEntry, updateEntry, Entry, EntryAudience } from "@/services/api"
import { getEntryPlaceholderText } from "@/lib/entry-placeholder"
import { FriendUser, getFriends } from "@/services/friends"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Lock, Users, Globe, X } from "lucide-react"
import { toast } from "sonner"

const AUDIENCE_OPTIONS: { value: EntryAudience; label: string; icon: typeof Lock }[] = [
  { value: "private", label: "เฉพาะฉัน", icon: Lock },
  { value: "friend", label: "เพื่อน", icon: Users },
  { value: "public", label: "สาธารณะ", icon: Globe },
]

interface DiaryFormProps {
  onSuccess: () => void;
  initialData?: Entry | null;
  token: string | undefined;
  userId: number | undefined;
  userName?: string;
  // Hashtags already used elsewhere, suggested when typing "#".
  existingHashtags?: string[];
}

export function DiaryForm({ onSuccess, initialData, token, userId, userName, existingHashtags }: DiaryFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(initialData?.title || "")
  // A brand-new entry (no initialData) opens with a text box already primed
  // for typing, seeded with the same invite as the composer card.
  const [elements, setElements] = useState<ScrapElement[]>(() =>
    initialData
      ? initialData.layout?.elements || []
      : [createPlaceholderTextElement(getEntryPlaceholderText(userName))]
  )
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
  // For the "@" mention autocomplete in the text editor below.
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [audience, setAudience] = useState<EntryAudience>(initialData?.audience ?? "private")

  useEffect(() => {
    if (!token) return
    getFriends(token)
      .then(setFriends)
      .catch(() => {
        /* autocomplete is a nicety — a failed fetch just means no suggestions */
      })
  }, [token])

  useEffect(() => {
    setTitle(initialData?.title || "")
    // No initialData means the new-entry state seeded above (placeholder text
    // box) should stand — only resync elements when there's real data to load.
    const nextElements = initialData?.layout?.elements || []
    if (initialData) setElements(nextElements)
    const canvasSrcs = new Set(
      nextElements.filter((el): el is ImageScrapElement => el.type === "image").map((el) => el.src)
    )
    setGalleryImages((initialData?.images || []).filter((src) => !canvasSrcs.has(src)))
    setAudience(initialData?.audience ?? "private")
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return toast.error("กรุณาเข้าสู่ระบบใหม่");

    setLoading(true)

    try {
      // Only gallery uploads go in `images` — canvas photos/stickers are
      // already visible on the page itself, so the full-view lightbox (which
      // reads this field) should show just what was explicitly added to the
      // gallery, not everything placed on the canvas.
      const images = galleryImages

      const payload = {
        title,
        content: "",
        images,
        created_by: "Watchara",
        layout: { pageWidth: PAGE_WIDTH, elements },
        audience,
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
          friends={friends}
          hashtagSuggestions={existingHashtags}
        />
      </div>

      {galleryImages.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">
            รูปแกลเลอรี
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

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">ใครเห็นโพสต์นี้ได้บ้าง</label>
        <Select value={audience} onValueChange={(v) => setAudience(v as EntryAudience)}>
          <SelectTrigger className="w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_OPTIONS.map(({ value, label, icon: Icon }) => (
              <SelectItem key={value} value={value}>
                <Icon className="mr-2 size-4" /> {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-lg font-bold bg-logo text-logo-foreground shadow-lg shadow-logo/20 hover:bg-logo/90"
        disabled={loading}
      >
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> กำลังบันทึก...</> : "MEMORY"}
      </Button>
    </form>
  )
}
