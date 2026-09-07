"use client"
import { useAuth } from "@/context/auth-context"
import { login } from "@/services/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form"

const loginSchema = z.object({
  username: z.string().min(1, { message: "✕ กรุณาระบุชื่อผู้ใช้" }),
  password: z.string().min(1, { message: "✕ กรุณาระบุรหัสผ่าน" }),
})

export default function LoginPage() {
  const { handleLogin } = useAuth()
  const router = useRouter()

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    const loginAction = login(values.username, values.password)

    toast.promise(loginAction, {
      loading: 'กำลังตรวจสอบข้อมูล...',
      success: (data) => {
        handleLogin(data.token, {
            userId: data.userId,
            username: data.username,
            full_name: data.full_name
        });
        setTimeout(() => {
          router.push("/")
        }, 1000)
        return `ยินดีต้อนรับคุณ ${data.full_name}!`;
      },
      error: (err) => err.message || "Login failed",
    })
  }

  // สร้างฟังก์ชันช่วยเลือก Class สำหรับ Shake และ Focus Color
  const getErrorClass = (fieldName: "username" | "password") => {
    return form.formState.errors[fieldName]
      ? "border-red-500 focus-visible:ring-red-500 animate-shake"
      : "border-neutral-200 focus-visible:ring-logo";
  }

  return (
    // Login page is pinned to a light, white look regardless of the app's
    // dark/light theme toggle — hence literal neutral-* colors below instead
    // of the theme-reactive bg-background / text-muted-foreground tokens.
    <div className="min-h-screen flex items-center justify-center bg-neutral-100 p-4">
      {/* เพิ่ม CSS สำหรับสั่นแบบ On-the-fly ถ้าไม่ได้แก้ tailwind.config */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>

      <Card className="w-full max-w-md shadow-2xl border-neutral-200 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pt-8">
          <CardTitle className="text-3xl font-bold text-center text-neutral-900 tracking-tight">
            Diary Login
          </CardTitle>
          <p className="text-center text-neutral-500 text-sm mt-2">เข้าสู่ระบบเพื่อบันทึกเรื่องราวของคุณ</p>
        </CardHeader>
        <CardContent className="p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="Username"
                        {...field}
                        className={`rounded-xl py-6 px-4 bg-white text-neutral-900 placeholder:text-neutral-400 transition-all duration-200 border-2 ${getErrorClass("username")}`}
                      />
                    </FormControl>
                    <FormMessage className="text-[12px] font-bold text-red-500 ml-1 mt-1 italic" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Password"
                        {...field}
                        className={`rounded-xl py-6 px-4 bg-white text-neutral-900 placeholder:text-neutral-400 transition-all duration-200 border-2 ${getErrorClass("password")}`}
                      />
                    </FormControl>
                    <FormMessage className="text-[12px] font-bold text-red-500 ml-1 mt-1 italic" />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-logo text-logo-foreground hover:bg-logo/90 py-7 rounded-xl text-lg font-bold transition-all shadow-lg active:scale-95 hover:shadow-logo/25"
              >
                Sign In
              </Button>

              <div className="text-sm text-neutral-500 text-center pt-2">
                Don't have an account?{' '}
                <Link
                  href="/register"
                  className="text-logo font-bold hover:underline decoration-2 underline-offset-4"
                >
                  Sign Up
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}