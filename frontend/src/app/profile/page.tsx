"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Loader2, User } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"
import { getProfile, updateProfile, ProfileUpdate } from "@/services/auth"
import { resizeImageToDataUrl } from "@/lib/image-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const emptyForm: ProfileUpdate = {
  full_name: "",
  birthdate: "",
  gender: "",
  country: "",
  facebook_link: "",
  gmail_link: "",
  apple_id_link: "",
  x_link: "",
  profile_picture: "",
}

export default function ProfilePage() {
  const router = useRouter()
  const { token, isLoading: authLoading, updateUser } = useAuth()
  const [username, setUsername] = useState("")
  const [form, setForm] = useState<ProfileUpdate>(emptyForm)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [saving, setSaving] = useState(false)
  const pictureInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !token) router.push("/login")
  }, [authLoading, token, router])

  useEffect(() => {
    if (!token) return
    setLoadingProfile(true)
    getProfile(token)
      .then((data) => {
        setUsername(data.username)
        setForm({
          full_name: data.full_name,
          birthdate: data.birthdate,
          gender: data.gender,
          country: data.country,
          facebook_link: data.facebook_link,
          gmail_link: data.gmail_link,
          apple_id_link: data.apple_id_link,
          x_link: data.x_link,
          profile_picture: data.profile_picture,
        })
      })
      .catch((err: any) => toast.error("Failed to load profile", { description: err.message }))
      .finally(() => setLoadingProfile(false))
  }, [token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handlePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    try {
      const dataUrl = await resizeImageToDataUrl(file)
      setForm((prev) => ({ ...prev, profile_picture: dataUrl }))
    } catch (err: any) {
      toast.error("Couldn't use that image", { description: err.message })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    try {
      await updateProfile(form, token)
      updateUser({ full_name: form.full_name, profile_picture: form.profile_picture })
      toast.success("Profile saved")
      router.push("/")
    } catch (err: any) {
      toast.error("Save failed", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-logo">
        <div className="container mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-white">Edit Profile</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => pictureInputRef.current?.click()}
              className="group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-logo hover:text-logo"
            >
              {form.profile_picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.profile_picture} alt="Profile" className="size-full object-cover" />
              ) : (
                <User className="size-10" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-6 text-white" />
              </span>
            </button>
            <input
              ref={pictureInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePictureChange}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Username</label>
            <Input value={username} disabled className="rounded-xl" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Full name</label>
              <Input name="full_name" value={form.full_name} onChange={handleChange} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date of birth</label>
              <Input
                name="birthdate"
                type="date"
                value={form.birthdate}
                onChange={handleChange}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Gender</label>
              <Select
                value={form.gender || undefined}
                onValueChange={(v) => setForm((prev) => ({ ...prev, gender: v }))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Country</label>
              <Input name="country" value={form.country} onChange={handleChange} className="rounded-xl" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Social media</label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                name="facebook_link"
                placeholder="Facebook"
                value={form.facebook_link}
                onChange={handleChange}
                className="rounded-xl"
              />
              <Input
                name="gmail_link"
                placeholder="Gmail"
                value={form.gmail_link}
                onChange={handleChange}
                className="rounded-xl"
              />
              <Input
                name="apple_id_link"
                placeholder="Apple ID"
                value={form.apple_id_link}
                onChange={handleChange}
                className="rounded-xl"
              />
              <Input
                name="x_link"
                placeholder="X (Twitter)"
                value={form.x_link}
                onChange={handleChange}
                className="rounded-xl"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-11 w-full rounded-xl bg-logo font-bold text-logo-foreground hover:bg-logo/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </form>
      </main>
    </div>
  )
}
