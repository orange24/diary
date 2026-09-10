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
      toast.error("Passwords don't match. Please check again.")
      return
    }

    setLoading(true)
    try {
      const { confirmPassword, ...submitData } = formData
      await register(submitData) 
      toast.success("Account created successfully! Redirecting you to the login page", {
        description: "You can log in with your new username right away",
      })
      router.push("/login")
    } catch (err: any) {
      toast.error("Something went wrong", { description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    // Same fixed light theme as the login page (see src/app/login/page.tsx) —
    // literal neutral-*/white colors instead of theme-reactive tokens, plus
    // bg-white! overrides where a shared component (Input, Select, Card) bakes
    // in a dark:bg-input/30-style class that would otherwise leak through
    // under the OS's dark color-scheme preference.
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-6">
      <Card className="w-full max-w-2xl shadow-2xl border-neutral-200 rounded-3xl overflow-hidden bg-white! text-neutral-900">
        <CardHeader className="pb-8">
          <CardTitle className="text-3xl font-bold text-center">
            Join the <span className="uppercase text-logo">Papymory</span> Community
          </CardTitle>
          <p className="text-center text-neutral-500">Fill in your details to get started</p>
        </CardHeader>

        <CardContent className="p-8">
          <form onSubmit={onSubmit} className="space-y-6">

            {/* ส่วนที่ 1: ข้อมูลบัญชี (Account Info) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Username *</label>
                <Input name="username" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Name</label>
                <Input name="full_name" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Password *</label>
                <Input name="password" type="password" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Confirm Password *</label>
                <Input name="confirmPassword" type="password" required onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
            </div>

            <hr className="border-neutral-200" />

            {/* ส่วนที่ 2: ข้อมูลส่วนตัว (Personal Info) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Birthdate</label>
                <Input name="birthdate" type="date" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Gender</label>
                <Select onValueChange={(v) => setFormData({...formData, gender: v})}>
                  <SelectTrigger className="rounded-xl bg-white!"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-white! text-neutral-900">
                    <SelectItem value="male" className="focus:bg-neutral-100! focus:text-neutral-900!">Male</SelectItem>
                    <SelectItem value="female" className="focus:bg-neutral-100! focus:text-neutral-900!">Female</SelectItem>
                    <SelectItem value="other" className="focus:bg-neutral-100! focus:text-neutral-900!">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Country</label>
                <Input name="country" placeholder="Thailand" onChange={handleChange} className="rounded-xl bg-white!" />
              </div>
            </div>

            <hr className="border-neutral-200" />

            {/* ส่วนที่ 3: Social Media Links (Optional) */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-neutral-500">Social Media Links</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input name="facebook_link" placeholder="Facebook Profile URL" onChange={handleChange} className="rounded-xl bg-blue-50!" />
                <Input name="gmail_link" placeholder="Gmail Address" onChange={handleChange} className="rounded-xl bg-red-50!" />
                <Input name="apple_id_link" placeholder="Apple ID" onChange={handleChange} className="rounded-xl bg-gray-50!" />
                <Input name="x_link" placeholder="X (Twitter) URL" onChange={handleChange} className="rounded-xl bg-slate-50!" />
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-logo text-logo-foreground hover:bg-logo/90 hover:scale-[1.02] transition-transform py-6 rounded-2xl text-lg font-bold shadow-lg shadow-logo/20">
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center p-6 border-t border-neutral-200 bg-white!">
          <p className="text-sm">Already a member? <Link href="/login" className="text-logo font-bold hover:underline">Sign In</Link></p>
        </CardFooter>
      </Card>
    </div>
  )
}