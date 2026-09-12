"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Pencil, Plus, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  FriendGroup,
  FriendListItem,
  FriendRequestItem,
  UserSearchResult,
  acceptFriendRequest,
  addGroupMember,
  createFriendGroup,
  deleteFriendGroup,
  getFriendGroups,
  getFriendRequests,
  getFriends,
  removeFriendship,
  removeGroupMember,
  renameFriendGroup,
  searchUsers,
  sendFriendRequest,
} from "@/services/friends"
import { toast } from "sonner"

interface FriendsExplorerProps {
  token: string | undefined
}

type Tab = "friends" | "requests" | "search" | "groups"

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  )
}

function PersonRow({
  name,
  username,
  avatarUrl,
  action,
}: {
  name: string
  username: string
  avatarUrl?: string
  action: React.ReactNode
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-10 shrink-0 border-2 border-primary/10">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name || username} />}
          <AvatarFallback className="bg-primary/5 text-xs font-bold text-primary">
            {getInitials(name || username)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">{name || username}</p>
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        </div>
      </div>
      {action}
    </li>
  )
}

// "Friends" tab: manage friends (list/unfriend), incoming requests
// (accept/reject), and search for people to add — the request must be
// accepted before a friend shows up in @mention autocomplete.
export function FriendsExplorer({ token }: FriendsExplorerProps) {
  const [tab, setTab] = useState<Tab>("friends")
  const [friends, setFriends] = useState<FriendListItem[]>([])
  const [requests, setRequests] = useState<FriendRequestItem[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [groups, setGroups] = useState<FriendGroup[]>([])
  const [newGroupName, setNewGroupName] = useState("")
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  const loadFriends = useCallback(async () => {
    if (!token) return
    try {
      setFriends(await getFriends(token))
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [token])

  const loadRequests = useCallback(async () => {
    if (!token) return
    try {
      setRequests(await getFriendRequests(token))
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [token])

  const loadGroups = useCallback(async () => {
    if (!token) return
    try {
      setGroups(await getFriendGroups(token))
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [token])

  useEffect(() => {
    loadFriends()
    loadRequests()
    loadGroups()
  }, [loadFriends, loadRequests, loadGroups])

  useEffect(() => {
    if (tab !== "search" || !query.trim() || !token) {
      setResults([])
      return
    }
    const handle = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await searchUsers(query.trim(), token))
      } catch (err: any) {
        toast.error(err.message)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [query, tab, token])

  const handleSendRequest = async (userId: number) => {
    if (!token) return
    try {
      await sendFriendRequest(userId, token)
      setResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, relationship: "outgoing" } : r))
      )
      loadFriends()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleAccept = async (id: number) => {
    if (!token) return
    try {
      await acceptFriendRequest(id, token)
      await Promise.all([loadFriends(), loadRequests()])
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRemove = async (id: number) => {
    if (!token) return
    try {
      await removeFriendship(id, token)
      await Promise.all([loadFriends(), loadRequests()])
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleCreateGroup = async () => {
    const name = newGroupName.trim()
    if (!token || !name) return
    try {
      const group = await createFriendGroup(name, token)
      setGroups((prev) => [...prev, group])
      setNewGroupName("")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const startRename = (group: FriendGroup) => {
    setEditingGroupId(group.id)
    setEditingName(group.name)
  }

  const saveRename = async (groupId: number) => {
    const name = editingName.trim()
    if (!token || !name) return
    try {
      await renameFriendGroup(groupId, name, token)
      setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)))
      setEditingGroupId(null)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeleteGroup = async (groupId: number) => {
    if (!token) return
    try {
      await deleteFriendGroup(groupId, token)
      setGroups((prev) => prev.filter((g) => g.id !== groupId))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Toggles one friend's membership in one group — an optimistic update
  // reconciled against the actual API result so a failed request doesn't
  // leave the checkbox lying about the real state.
  const handleToggleMember = async (groupId: number, friend: FriendListItem, isMember: boolean) => {
    if (!token) return
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              members: isMember
                ? g.members.filter((m) => m.id !== friend.id)
                : [...g.members, { id: friend.id, username: friend.username, full_name: friend.full_name, profile_picture: friend.profile_picture }],
            }
      )
    )
    try {
      if (isMember) await removeGroupMember(groupId, friend.id, token)
      else await addGroupMember(groupId, friend.id, token)
    } catch (err: any) {
      toast.error(err.message)
      loadGroups()
    }
  }

  // The tab badge counts only incoming requests — the ones actually
  // waiting on this user to do something — not outgoing ones too.
  const incomingCount = requests.filter((r) => r.direction === "incoming").length

  const tabs: { id: Tab; label: string }[] = [
    { id: "friends", label: "My Friends" },
    { id: "requests", label: incomingCount > 0 ? `Friend Requests (${incomingCount})` : "Friend Requests" },
    { id: "search", label: "Find Friends" },
    { id: "groups", label: "Groups" },
  ]

  return (
    <div>
      <div className="mb-8 flex items-center gap-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative pb-3 text-sm font-semibold transition-colors",
              tab === t.id ? "text-logo" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-logo" />}
          </button>
        ))}
      </div>

      {tab === "friends" &&
        (friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">No friends yet. Try searching for some!</p>
        ) : (
          <ul className="space-y-3">
            {friends.map((f) => (
              <PersonRow
                key={f.friendship_id}
                name={f.full_name}
                username={f.username}
                avatarUrl={f.profile_picture}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(f.friendship_id)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <UserMinus className="size-4" /> Remove Friend
                  </Button>
                }
              />
            ))}
          </ul>
        ))}

      {tab === "requests" &&
        (requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No new friend requests</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <PersonRow
                key={r.id}
                name={r.user.full_name}
                username={r.user.username}
                avatarUrl={r.user.profile_picture}
                action={
                  r.direction === "incoming" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAccept(r.id)}
                        className="bg-logo text-logo-foreground hover:bg-logo/90"
                      >
                        <Check className="size-4" /> Accept
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(r.id)}>
                        <X className="size-4" /> Decline
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Request sent</span>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(r.id)}>
                        <X className="size-4" /> Cancel
                      </Button>
                    </div>
                  )
                }
              />
            ))}
          </ul>
        ))}

      {tab === "search" && (
        <div>
          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or name..."
              className="rounded-full pl-10"
              autoFocus
            />
          </div>

          {searching && <p className="text-sm text-muted-foreground">Searching...</p>}

          {!searching && query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found matching &ldquo;{query}&rdquo;</p>
          )}

          {results.length > 0 && (
            <ul className="space-y-3">
              {results.map((r) => (
                <PersonRow
                  key={r.id}
                  name={r.full_name}
                  username={r.username}
                  avatarUrl={r.profile_picture}
                  action={
                    r.relationship === "friends" ? (
                      <span className="text-sm font-medium text-muted-foreground">Already friends</span>
                    ) : r.relationship === "outgoing" ? (
                      <span className="text-sm font-medium text-muted-foreground">Request sent</span>
                    ) : r.relationship === "incoming" ? (
                      <Button
                        size="sm"
                        onClick={() => r.friendship_id && handleAccept(r.friendship_id)}
                        className="bg-logo text-logo-foreground hover:bg-logo/90"
                      >
                        <Check className="size-4" /> Accept Request
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleSendRequest(r.id)}>
                        <UserPlus className="size-4" /> Add Friend
                      </Button>
                    )
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "groups" && (
        <div>
          <div className="mb-6 flex gap-2">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="New group name (e.g. Family)..."
              className="rounded-full"
            />
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
              <Plus className="size-4" /> Create
            </Button>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No groups yet. Create one to share posts with only part of your friend list.
            </p>
          ) : (
            <ul className="space-y-4">
              {groups.map((g) => (
                <li key={g.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    {editingGroupId === g.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveRename(g.id)}
                          autoFocus
                          className="rounded-full"
                        />
                        <Button size="sm" onClick={() => saveRename(g.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingGroupId(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-card-foreground">
                          {g.name}{" "}
                          <span className="font-normal text-xs text-muted-foreground">
                            ({g.members.length} {g.members.length === 1 ? "friend" : "friends"})
                          </span>
                        </span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startRename(g)} title="Rename">
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteGroup(g.id)}
                            title="Delete group"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  {friends.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add some friends first to put them in this group.</p>
                  ) : (
                    <ul className="space-y-1">
                      {friends.map((f) => {
                        const isMember = g.members.some((m) => m.id === f.id)
                        return (
                          <li key={f.id} className="flex items-center justify-between py-1 text-sm">
                            <span className="text-card-foreground">{f.full_name || f.username}</span>
                            <Button
                              size="sm"
                              variant={isMember ? "secondary" : "outline"}
                              onClick={() => handleToggleMember(g.id, f, isMember)}
                            >
                              {isMember && <Check className="size-3.5" />} {isMember ? "In group" : "Add"}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
