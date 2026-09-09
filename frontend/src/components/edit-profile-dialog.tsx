"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-context"
import { getProfile, updateProfile, ProfileUpdate } from "@/services/auth"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const emptyForm: ProfileUpdate = {
  full_name: "",
  birthdate: "",
  gender: "",
  country: "",
  facebook_link: "",
  gmail_link: "",
  apple_id_link: "",
  x_link: "",
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { token, updateUser } = useAuth()
  const [username, setUsername] = useState("")
  const [form, setForm] = useState<ProfileUpdate>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Username/birthdate/gender/etc. aren't in the auth context (only
  // userId/username/full_name are), so every open re-fetches the full
  // profile from the backend to populate the form.
  useEffect(() => {
    if (!open || !token) return
    setLoading(true)
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
        })
      })
      .catch((err: any) => toast.error("โหลดโปรไฟล์ไม่สำเร็จ", { description: err.message }))
      .finally(() => setLoading(false))
  }, [open, token])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    try {
      await updateProfile(form, token)
      updateUser({ full_name: form.full_name })
      toast.success("บันทึกโปรไฟล์แล้ว")
      onOpenChange(false)
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ", { description: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl border-primary/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold tracking-tight">แก้ไขโปรไฟล์</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" /> กำลังโหลด...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Username</label>
              <Input value={username} disabled className="rounded-xl" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">ชื่อเต็ม</label>
                <Input name="full_name" value={form.full_name} onChange={handleChange} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">วันเกิด</label>
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
                <label className="text-sm font-semibold text-foreground">เพศ</label>
                <Select
                  value={form.gender || undefined}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, gender: v }))}
                >
                  <SelectTrigger className="w-full rounded-xl">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ชาย</SelectItem>
                    <SelectItem value="female">หญิง</SelectItem>
                    <SelectItem value="other">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">ประเทศ</label>
                <Input name="country" value={form.country} onChange={handleChange} className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">โซเชียลมีเดีย</label>
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
                  <Loader2 className="mr-2 size-4 animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                "บันทึกการเปลี่ยนแปลง"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
