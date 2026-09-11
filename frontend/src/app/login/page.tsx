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
import { useLocale } from "@/context/locale-context"
import { translateError } from "@/lib/i18n"
import { LanguageLinkSwitcher } from "@/components/language-link-switcher"

export default function LoginPage() {
  const { handleLogin } = useAuth()
  const { t } = useLocale()
  const router = useRouter()

  const loginSchema = z.object({
    username: z.string().min(1, { message: t("login.usernameRequired") }),
    password: z.string().min(1, { message: t("login.passwordRequired") }),
  })

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    try {
      const data = await login(values.username, values.password)
      handleLogin(data.token, {
        userId: data.userId,
        username: data.username,
        full_name: data.full_name,
        profile_picture: data.profile_picture,
        slug: data.slug,
        locale: data.locale,
      })
      router.push("/")
    } catch (err: any) {
      toast.error(translateError(err, t) || t("login.loginFailed"))
    }
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-100 p-4">
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
        /* Chrome paints its own gray/yellow tint over autofilled fields,
           overriding bg-white — force it back to white on this fixed-light page. */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px white inset;
          -webkit-text-fill-color: #171717;
        }
      `}</style>

      <Card className="w-full max-w-md shadow-2xl border-neutral-200 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pt-8">
          <CardTitle className="text-3xl font-bold text-center text-neutral-900 tracking-tight">
            <span className="uppercase text-logo">Papymory</span> {t("login.title")}
          </CardTitle>
          <p className="text-center text-neutral-500 text-sm mt-2">{t("login.subtitle")}</p>
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
                        placeholder={t("login.usernamePlaceholder")}
                        {...field}
                        className={`rounded-xl py-6 px-4 bg-white! text-neutral-900 placeholder:text-neutral-400 transition-all duration-200 border-2 ${getErrorClass("username")}`}
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
                        placeholder={t("login.passwordPlaceholder")}
                        {...field}
                        className={`rounded-xl py-6 px-4 bg-white! text-neutral-900 placeholder:text-neutral-400 transition-all duration-200 border-2 ${getErrorClass("password")}`}
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
                {t("login.signIn")}
              </Button>

              <div className="text-sm text-neutral-500 text-center pt-2">
                {t("login.noAccount")}{' '}
                <Link
                  href="/register"
                  className="text-logo font-bold hover:underline decoration-2 underline-offset-4"
                >
                  {t("login.signUp")}
                </Link>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <LanguageLinkSwitcher className="mt-6" />
    </div>
  )
}