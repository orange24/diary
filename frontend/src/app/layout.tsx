import "./globals.css";
import { Prompt } from "next/font/google";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import { ThemeProvider } from "next-themes"

const prompt = Prompt({
  subsets: ['latin'], variable: '--font-sans',
  weight: "100"
});

export const metadata: Metadata = {
  title: 'My Daily Diary',
  description: 'A personal diary dashboard to capture your daily thoughts and memories',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="week-1">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}