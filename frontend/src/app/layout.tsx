import "@/styles/globals.css";
import { Prompt } from "next/font/google";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import { AuthProvider } from "@/context/auth-context"
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner"

const prompt = Prompt({
  subsets: ['thai', 'latin'], // เพิ่ม thai เข้าไปด้วยเพื่อให้รองรับภาษาไทยสวยๆ ครับ
  variable: '--font-sans',
  weight: ["300", "400", "500", "700"] // เพิ่ม weight ให้ครอบคลุมการใช้งาน
});

export const metadata: Metadata = {
  title: 'My Daily Diary',
  description: 'A personal diary dashboard to capture your daily thoughts and memories',
  // ... metadata อื่นๆ ของคุณคงเดิม ...
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
        <body 
          className={cn(
            "min-h-screen bg-background font-sans antialiased transition-colors duration-700 ease-in-out", 
            prompt.variable
          )}
        >

          <AuthProvider>
            <ThemeProvider 
              attribute="data-theme" 
              defaultTheme="week-1" 
              enableSystem={false}
            >
              {children}
              <Toaster position="top-center" richColors />
            </ThemeProvider>
          </AuthProvider>
        </body>
    </html>
  )
}