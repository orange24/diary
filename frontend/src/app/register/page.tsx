"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { register } from "@/services/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { toast } from "sonner"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    full_name: "",
    birthdate: "",
    gender: "",
    country: "",
    facebook_link: "",
    gmail_link: "",
    apple_id_link: "",
    x_link: ""
  })
  
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง")
      return
    }

    setLoading(true)
    try {
      const { confirmPassword, ...submitData } = formData
      await register(submitData) 
      toast.success("สร้างบัญชีสำเร็จ! กำลังพากลับไปหน้า Login", {
        description: "คุณสามารถเข้าสู่ระบบด้วยชื่อผู้ใช้ใหม่ได้ทันที",
      })
      router.push("/login")
    } catch (err: any) {
      toast.error("เกิดข้อผิดพลาด", { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 transition-colors duration-1000">
      <Card className="w-full max-w-2xl shadow-2xl border-primary/20 rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 pb-8">
          <CardTitle className="text-3xl font-bold text-center text-primary">Join the Community</CardTitle>
          <p className="text-center text-muted-foreground">Fill in your details to get started</p>
        </CardHeader>
        
        <CardContent className="p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            
            {/* ส่วนที่ 1: ข้อมูลบัญชี (Account Info) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Username *</label>
                <Input name="username" required onChange={handleChange} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Name</label>
                <Input name="full_name" onChange={handleChange} className="rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Password *</label>
                <Input name="password" type="password" required onChange={handleChange} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Confirm Password *</label>
                <Input name="confirmPassword" type="password" required onChange={handleChange} className="rounded-xl" />
              </div>
            </div>

            <hr className="border-primary/10" />

            {/* ส่วนที่ 2: ข้อมูลส่วนตัว (Personal Info) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Birthdate</label>
                <Input name="birthdate" type="date" onChange={handleChange} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Gender</label>
                <Select onValueChange={(v) => setFormData({...formData, gender: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Country</label>
                <Input name="country" placeholder="Thailand" onChange={handleChange} className="rounded-xl" />
              </div>
            </div>

            <hr className="border-primary/10" />

            {/* ส่วนที่ 3: Social Media Links (Optional) */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-primary/70">Social Media Links</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input name="facebook_link" placeholder="Facebook Profile URL" onChange={handleChange} className="rounded-xl bg-blue-50/50" />
                <Input name="gmail_link" placeholder="Gmail Address" onChange={handleChange} className="rounded-xl bg-red-50/50" />
                <Input name="apple_id_link" placeholder="Apple ID" onChange={handleChange} className="rounded-xl bg-gray-50/50" />
                <Input name="x_link" placeholder="X (Twitter) URL" onChange={handleChange} className="rounded-xl bg-slate-50/50" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-primary hover:scale-[1.02] transition-transform py-6 rounded-2xl text-lg font-bold shadow-lg">
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center p-6 bg-primary/5">
          <p className="text-sm">Already a member? <Link href="/login" className="text-primary font-bold hover:underline">Sign In</Link></p>
        </CardFooter>
      </Card>
    </div>
  )
}