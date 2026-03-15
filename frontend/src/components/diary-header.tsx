"use client"

import { Button } from "@/components/ui/button"
import { Plus, BookOpen, LogOut, User } from "lucide-react"
import { ThemeSwitcher } from "./theme-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface DiaryHeaderProps {
  onNewEntry?: () => void
  onLogout?: () => void
  userName?: string
}

export function DiaryHeader({ onNewEntry, onLogout, userName }: DiaryHeaderProps) {
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
    <header className="sticky top-0 z-40 w-full bg-background/80 backdrop-blur-md border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left Side: Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-primary shadow-lg shadow-primary/20">
            <BookOpen className="size-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden md:block">
            My Daily Diary
          </h1>
        </div>

        {/* Right Side: Actions & User Profile */}
        <div className="flex items-center gap-3">
          <ThemeSwitcher />

          <Button 
            onClick={onNewEntry} 
            className="rounded-full px-4 shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <Plus className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">New Entry</span>
          </Button>

          <div className="h-6 w-[1px] bg-border mx-1" />

          {/* User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-10 rounded-full p-0 overflow-hidden hover:bg-muted">
                <Avatar className="size-10 border-2 border-primary/10">
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