"use client"

import { FriendsExplorer } from "@/components/friends-explorer"
import { useAuth } from "@/context/auth-context"

export default function FriendsPage() {
  const { token } = useAuth()
  return <FriendsExplorer token={token} />
}
