"use client"

import * as React from "react"
import { Palette, Sun, Moon, Waves, Flower, TreePine, Sunset } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeSwitcher() {
  const { setTheme, theme } = useTheme()

  const themes = [
    { id: "week-1", name: "Week 1: Ocean", icon: <Waves className="mr-2 h-4 w-4" /> },
    { id: "week-2", name: "Week 2: Sakura", icon: <Flower className="mr-2 h-4 w-4" /> },
    { id: "week-3", name: "Week 3: Forest", icon: <TreePine className="mr-2 h-4 w-4" /> },
    { id: "week-4", name: "Week 4: Sunset", icon: <Sunset className="mr-2 h-4 w-4" /> },
  ]

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full shadow-md border-primary/20">
            <Palette className="h-[1.2rem] w-[1.2rem] text-primary" />
            <span className="sr-only">Toggle theme</span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl p-2 bg-primary/10 backdrop-blur-sm border border-primary/20">
            {themes.map((t) => (
            <DropdownMenuItem
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`cursor-pointer rounded-lg mb-1 ${theme === t.id ? 'bg-primary/10 text-primary font-bold' : ''}`}
            >
                {t.icon}
                <span>{t.name}</span>
            </DropdownMenuItem>
            ))}
        </DropdownMenuContent>
    </DropdownMenu>
  )
}