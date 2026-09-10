"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, User } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { getPublicProfile, PublicProfileResponse } from "@/services/api"
import { DiaryGrid } from "@/components/diary-grid"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export default function PublicProfilePage() {
  const params = useParams() as { slug?: string }
  const slug = params?.slug
  const router = useRouter()
  const { token, user, isLoading: authLoading } = useAuth()

  const [data, setData] = useState<PublicProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !token) router.push("/login")
  }, [authLoading, token, router])

  useEffect(() => {
    if (!token || !slug) return
    setLoading(true)
    setError(null)
    getPublicProfile(slug, token)
      .then(setData)
      .catch((err: any) => setError(err.message || "Failed to load profile"))
      .finally(() => setLoading(false))
  }, [token, slug])

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 w-full border-b bg-logo">
        <div className="container mx-auto flex h-16 max-w-4xl items-center gap-3 px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full text-white hover:bg-white/10 hover:text-white"
            onClick={() => router.push("/")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-tight text-white">Profile</h1>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-10">
        {error || !data ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-12 text-center">
            <p className="text-lg font-semibold text-foreground">Profile not found</p>
            <p className="text-sm text-muted-foreground">{error || "This profile link doesn't exist."}</p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex flex-col items-center gap-3 rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
              <Avatar className="size-24 border-2 border-primary/10">
                {data.profile.profile_picture && (
                  <AvatarImage src={data.profile.profile_picture} alt={data.profile.full_name || data.profile.username} />
                )}
                <AvatarFallback className="bg-primary/5 text-2xl font-bold text-primary">
                  <User className="size-10" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-bold text-foreground">{data.profile.full_name || data.profile.username}</p>
                <p className="text-sm text-muted-foreground">@{data.profile.username}</p>
              </div>

              {(data.profile.facebook_link || data.profile.gmail_link || data.profile.apple_id_link || data.profile.x_link) && (
                <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                  {data.profile.facebook_link && (
                    <a href={data.profile.facebook_link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-logo hover:underline">
                      Facebook
                    </a>
                  )}
                  {data.profile.gmail_link && (
                    <a href={`mailto:${data.profile.gmail_link}`} className="text-sm font-medium text-logo hover:underline">
                      Gmail
                    </a>
                  )}
                  {data.profile.apple_id_link && (
                    <span className="text-sm font-medium text-muted-foreground">Apple ID: {data.profile.apple_id_link}</span>
                  )}
                  {data.profile.x_link && (
                    <a href={data.profile.x_link} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-logo hover:underline">
                      X (Twitter)
                    </a>
                  )}
                </div>
              )}
            </div>

            {data.entries.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Nothing to show here yet.</p>
            ) : (
              <DiaryGrid entries={data.entries} currentUserId={user?.userId} />
            )}
          </>
        )}
      </main>
    </div>
  )
}
