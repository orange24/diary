"use client"

import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { BookOpen, LogOut, User, Home, Hash, Users, UserCog, Moon, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { useLocale } from "@/context/locale-context"
import { SUPPORTED_LOCALES } from "@/locales"

const LOCALE_LABELS: Record<string, string> = { en: "English", th: "ไทย" }

interface DiaryHeaderProps {
  onLogout?: () => void
  userName?: string
  userAvatar?: string
  userSlug?: string
}

export function DiaryHeader({ onLogout, userName, userAvatar, userSlug }: DiaryHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"
  const { locale, setLocale, t } = useLocale()
  const navItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { href: "/", label: t("header.navHome"), icon: Home },
    { href: "/hashtags", label: t("header.navHashtag"), icon: Hash },
    { href: "/friends", label: t("header.navFriends"), icon: Users },
  ]

  // สร้างชื่อย่อสำหรับ Avatar (เช่น Watchara Kittikum -> WK)
  const getInitials = (name?: string) => {
    if (!name) return <User className="size-4" />;
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-logo border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">

        {/* Left Side: Logo & Title — clicking it returns to the home feed */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-white shadow-lg">
            <BookOpen className="size-5 text-logo" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase text-white hidden md:block">
            Papymory
          </h1>
        </Link>

        {/* Center: Home / Hashtag / Friends nav — plain spaced-out icons,
            Facebook-style, with an underline bar marking the active tab */}
        <nav className="flex h-full items-center gap-8 sm:gap-14">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "relative flex h-full items-center px-2 transition-colors",
                pathname === href ? "text-white" : "text-white/60 hover:text-white/90"
              )}
            >
              <Icon className="size-6" />
              {pathname === href && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />
              )}
            </Link>
          ))}
        </nav>

        {/* Right Side: User Profile */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-10 rounded-full p-0 overflow-hidden hover:bg-muted">
                <Avatar className="size-10 border-2 border-primary/10">
                  {userAvatar && <AvatarImage src={userAvatar} alt={userName || "Profile"} />}
                  <AvatarFallback className="bg-primary/5 text-primary font-bold text-xs">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56 mt-2 rounded-xl shadow-xl border-primary/10" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-bold leading-none">{userName || t("header.guestUser")}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer font-medium">
                <UserCog className="mr-2 size-4" />
                <span>{t("header.editProfile")}</span>
              </DropdownMenuItem>
              {userSlug && (
                <DropdownMenuItem onClick={() => router.push(`/${userSlug}`)} className="cursor-pointer font-medium">
                  <User className="mr-2 size-4" />
                  <span>{t("header.myPublicProfile")}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuCheckboxItem
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="cursor-pointer font-medium"
              >
                <Moon className="mr-2 size-4" />
                <span>{t("header.darkMode")}</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("header.language")}
              </DropdownMenuLabel>
              {SUPPORTED_LOCALES.map((code) => (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setLocale(code)}
                  className="cursor-pointer font-medium"
                >
                  <Check className={`mr-2 size-4 ${locale === code ? "opacity-100" : "opacity-0"}`} />
                  <span>{LOCALE_LABELS[code] ?? code}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer font-medium"
              >
                <LogOut className="mr-2 size-4" />
                <span>{t("header.logout")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}