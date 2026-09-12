"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrapbookEditor } from "@/components/scrapbook/ScrapbookEditor"
import { ScrapElement, ImageScrapElement, PAGE_WIDTH, createPlaceholderTextElement } from "@/types/scrapbook"
import { createEntry, updateEntry, Entry, EntryAudience } from "@/services/api"
import { getEntryPlaceholderText } from "@/lib/entry-placeholder"
import { FriendGroup, FriendUser, getFriendGroups, getFriends } from "@/services/friends"
import { useLocale } from "@/context/locale-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, Lock, Users, Globe, X } from "lucide-react"
import { toast } from "sonner"

const AUDIENCE_OPTIONS: { value: EntryAudience; label: string; icon: typeof Lock }[] = [
  { value: "private", label: "Only me", icon: Lock },
  { value: "friend", label: "Friends", icon: Users },
  { value: "public", label: "Public", icon: Globe },
]

// Formats a Date as the "YYYY-MM-DD" an <input type="date"> needs, in the
// browser's local timezone (toISOString() alone would shift by the UTC
// offset and can land on the wrong calendar day).
function toDateInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// Formats a Date as the "HH:mm" an <input type="time"> needs, in the
// browser's local timezone.
function toTimeInputValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

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
  const { t } = useLocale()
  const [title, setTitle] = useState(initialData?.title || "")
  // A brand-new entry (no initialData) opens with a text box already primed
  // for typing, seeded with the same invite as the composer card.
  const [elements, setElements] = useState<ScrapElement[]>(() =>
    initialData
      ? initialData.layout?.elements || []
      : [createPlaceholderTextElement(getEntryPlaceholderText(t, userName))]
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
  // Which of the author's friend groups this post is scoped to when
  // audience is "friend" — empty means "all friends" (the default).
  const [friendGroups, setFriendGroups] = useState<FriendGroup[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>(initialData?.friend_group_ids ?? [])
  const [createdDate, setCreatedDate] = useState<string>(() =>
    toDateInputValue(initialData?.created_date ? new Date(initialData.created_date) : new Date())
  )
  const [createdTime, setCreatedTime] = useState<string>(() =>
    toTimeInputValue(initialData?.created_date ? new Date(initialData.created_date) : new Date())
  )

  useEffect(() => {
    if (!token) return
    getFriends(token)
      .then(setFriends)
      .catch(() => {
        /* autocomplete is a nicety — a failed fetch just means no suggestions */
      })
    getFriendGroups(token)
      .then(setFriendGroups)
      .catch(() => {
        /* no groups shown just means everyone posts to "all friends" */
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
    setSelectedGroupIds(initialData?.friend_group_ids ?? [])
    const initialDateObj = initialData?.created_date ? new Date(initialData.created_date) : new Date()
    setCreatedDate(toDateInputValue(initialDateObj))
    setCreatedTime(toTimeInputValue(initialDateObj))
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return toast.error("Please log in again");

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
        friend_group_ids: audience === "friend" ? selectedGroupIds : [],
        created_date: `${createdDate}T${createdTime}:00`,
      };

      if (initialData?.id) {
        await updateEntry(initialData.id, payload, token);
      } else {
        await createEntry(payload, token);
      }

      onSuccess();
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Date &amp; Time</label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="date"
            value={createdDate}
            onChange={(e) => setCreatedDate(e.target.value)}
            className="w-full rounded-xl"
          />
          <Input
            type="time"
            value={createdTime}
            onChange={(e) => setCreatedTime(e.target.value)}
            className="w-full rounded-xl"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Decorate your page</label>
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
            Gallery
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
                  title="Remove this image from the gallery"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground">Who can see this post</label>
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

        {audience === "friend" && friendGroups.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">
              Share with everyone, or just specific group(s) — leave none checked for all friends.
            </p>
            <div className="flex flex-wrap gap-2">
              {friendGroups.map((g) => {
                const checked = selectedGroupIds.includes(g.id)
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() =>
                      setSelectedGroupIds((prev) =>
                        checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      checked
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {g.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-lg font-bold bg-logo text-logo-foreground shadow-lg shadow-logo/20 hover:bg-logo/90"
        disabled={loading}
      >
        {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</> : "MEMORY"}
      </Button>
    </form>
  )
}
