"use client"
import { createContext, useContext, useState, useEffect } from "react"

// 1. นิยามโครงสร้าง User ให้ชัดเจน (เหมือนการสร้าง POJO ใน Java)
interface UserData {
  userId: number;
  username: string;
  full_name: string;
}

interface AuthContextType {
  token: string | undefined;
  user: UserData | undefined;
  handleLogin: (token: string, userData: UserData) => void;
  handleLogout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | undefined>(undefined)
  const [user, setUser] = useState<UserData | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // ดึงข้อมูลจาก LocalStorage เมื่อโหลดหน้า
    const savedToken = localStorage.getItem("diary_token")
    const savedUser = localStorage.getItem("user")

    if (savedToken) {
      setToken(savedToken)
    } else {
      setToken("") 
    }

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        console.error("Failed to parse user data", e)
        localStorage.removeItem("user")
      }
    }
    
    setIsLoading(false)
  }, [])

  // 2. ปรับ handleLogin ให้รับก้อนข้อมูล User มาบันทึกพร้อมกัน
  const handleLogin = (newToken: string, userData: UserData) => {
    localStorage.setItem("diary_token", newToken)
    localStorage.setItem("user", JSON.stringify(userData))
    
    setToken(newToken)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem("diary_token")
    localStorage.removeItem("user")
    setToken("")
    setUser(undefined)
  }

  return (
    <AuthContext.Provider value={{ token, user, handleLogin, handleLogout, isLoading }}>
      {/* ป้องกันหน้ากระพริบ (FOUC) ขณะกำลังเช็ค Token */}
      {!isLoading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}