"use client"

import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { BookOpen, LogOut, User, Home, Hash, Users, UserCog, Moon } from "lucide-react"
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

export type DiaryView = "home" | "hashtags" | "friends"

const NAV_ITEMS: { view: DiaryView; label: string; icon: typeof Home }[] = [
  { view: "home", label: "Home", icon: Home },
  { view: "hashtags", label: "Hashtag", icon: Hash },
  { view: "friends", label: "Friends", icon: Users },
]

interface DiaryHeaderProps {
  onLogout?: () => void
  userName?: string
  userAvatar?: string
  userSlug?: string
  activeView: DiaryView
  onViewChange: (view: DiaryView) => void
}

export function DiaryHeader({ onLogout, userName, userAvatar, userSlug, activeView, onViewChange }: DiaryHeaderProps) {
  const router = useRouter()
  const { setTheme, theme } = useTheme()
  const isDark = theme === "dark"

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
        <button
          type="button"
          onClick={() => {
            onViewChange("home")
            router.push("/")
          }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center justify-center size-10 rounded-xl bg-white shadow-lg">
            <BookOpen className="size-5 text-logo" />
          </div>
          <h1 className="text-xl font-bold tracking-tight uppercase text-white hidden md:block">
            Papymory
          </h1>
        </button>

        {/* Center: Home / Hashtag / Friends nav — plain spaced-out icons,
            Facebook-style, with an underline bar marking the active tab */}
        <nav className="flex h-full items-center gap-8 sm:gap-14">
          {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              type="button"
              title={label}
              onClick={() => onViewChange(view)}
              className={cn(
                "relative flex h-full items-center px-2 transition-colors",
                activeView === view ? "text-white" : "text-white/60 hover:text-white/90"
              )}
            >
              <Icon className="size-6" />
              {activeView === view && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-white" />
              )}
            </button>
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
                  <p className="text-sm font-bold leading-none">{userName || "Guest User"}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profile")} className="cursor-pointer font-medium">
                <UserCog className="mr-2 size-4" />
                <span>Edit Profile</span>
              </DropdownMenuItem>
              {userSlug && (
                <DropdownMenuItem onClick={() => router.push(`/${userSlug}`)} className="cursor-pointer font-medium">
                  <User className="mr-2 size-4" />
                  <span>My Public Profile</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuCheckboxItem
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                className="cursor-pointer font-medium"
              >
                <Moon className="mr-2 size-4" />
                <span>Dark Mode</span>
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onLogout}
                className="text-destructive focus:text-destructive cursor-pointer font-medium"
              >
                <LogOut className="mr-2 size-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}