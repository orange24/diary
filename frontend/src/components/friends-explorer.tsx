"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Link2, Pencil, Plus, Search, Trash2, UserMinus, UserPlus, X } from "lucide-react"
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
import {
  Contact,
  ContactLinkRequestItem,
  acceptContactLink,
  createContact,
  declineContactLink,
  deleteContact,
  getContactLinkRequests,
  getContacts,
  requestContactLink,
  updateContact,
} from "@/services/contacts"
import { toast } from "sonner"

interface FriendsExplorerProps {
  token: string | undefined
}

type Tab = "friends" | "requests" | "search" | "groups" | "people"

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
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contactRequests, setContactRequests] = useState<ContactLinkRequestItem[]>([])
  const [newContactName, setNewContactName] = useState("")
  const [newContactRelationship, setNewContactRelationship] = useState("")
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [editingContactName, setEditingContactName] = useState("")
  const [editingContactRelationship, setEditingContactRelationship] = useState("")
  const [editingContactHandle, setEditingContactHandle] = useState("")
  const [linkingContactId, setLinkingContactId] = useState<number | null>(null)

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

  const loadContacts = useCallback(async () => {
    if (!token) return
    try {
      setContacts(await getContacts(token))
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [token])

  const loadContactRequests = useCallback(async () => {
    if (!token) return
    try {
      setContactRequests(await getContactLinkRequests(token))
    } catch (err: any) {
      toast.error(err.message)
    }
  }, [token])

  useEffect(() => {
    loadFriends()
    loadRequests()
    loadGroups()
    loadContacts()
    loadContactRequests()
  }, [loadFriends, loadRequests, loadGroups, loadContacts, loadContactRequests])

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

  const handleCreateContact = async () => {
    const name = newContactName.trim()
    if (!token || !name) return
    try {
      const contact = await createContact(name, newContactRelationship.trim(), token)
      setContacts((prev) => [...prev, contact])
      setNewContactName("")
      setNewContactRelationship("")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const startEditContact = (contact: Contact) => {
    setEditingContactId(contact.id)
    setEditingContactName(contact.name)
    setEditingContactRelationship(contact.relationship)
    setEditingContactHandle(contact.handle)
  }

  const saveEditContact = async (contactId: number) => {
    const name = editingContactName.trim()
    const handle = editingContactHandle.trim()
    if (!token || !name || !handle) return
    try {
      await updateContact(contactId, { name, relationship: editingContactRelationship.trim(), handle }, token)
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId ? { ...c, name, relationship: editingContactRelationship.trim(), handle } : c
        )
      )
      setEditingContactId(null)
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeleteContact = async (contactId: number) => {
    if (!token) return
    try {
      await deleteContact(contactId, token)
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleRequestLink = async (contactId: number, targetUserId: number) => {
    if (!token) return
    try {
      await requestContactLink(contactId, targetUserId, token)
      setLinkingContactId(null)
      loadContacts()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  // Cancelling your own outgoing request and declining someone else's
  // incoming one are the same call — the backend allows either party to
  // clear a pending link.
  const handleCancelOwnLink = async (contactId: number) => {
    if (!token) return
    try {
      await declineContactLink(contactId, token)
      loadContacts()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleAcceptIncoming = async (contactId: number) => {
    if (!token) return
    try {
      await acceptContactLink(contactId, token)
      loadContactRequests()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleDeclineIncoming = async (contactId: number) => {
    if (!token) return
    try {
      await declineContactLink(contactId, token)
      loadContactRequests()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const incomingContactRequests = contactRequests.filter((r) => r.direction === "incoming")
  const outgoingContactRequests = contactRequests.filter((r) => r.direction === "outgoing")

  // The tab badge counts only incoming requests — the ones actually
  // waiting on this user to do something — not outgoing ones too.
  const incomingCount = requests.filter((r) => r.direction === "incoming").length

  const tabs: { id: Tab; label: string }[] = [
    { id: "friends", label: "My Friends" },
    { id: "requests", label: incomingCount > 0 ? `Friend Requests (${incomingCount})` : "Friend Requests" },
    { id: "search", label: "Find Friends" },
    { id: "groups", label: "Groups" },
    {
      id: "people",
      label:
        incomingContactRequests.length > 0 ? `People (${incomingContactRequests.length})` : "People",
    },
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

      {tab === "people" && (
        <div>
          {(incomingContactRequests.length > 0 || outgoingContactRequests.length > 0) && (
            <div className="mb-8 space-y-3">
              {incomingContactRequests.map((r) => (
                <PersonRow
                  key={`incoming-${r.contact_id}`}
                  name={r.other_user.full_name}
                  username={r.other_user.username}
                  avatarUrl={r.other_user.profile_picture}
                  action={
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        wants to link you as their {r.relationship || r.name}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptIncoming(r.contact_id)}
                        className="bg-logo text-logo-foreground hover:bg-logo/90"
                      >
                        <Check className="size-4" /> Accept
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeclineIncoming(r.contact_id)}>
                        <X className="size-4" /> Decline
                      </Button>
                    </div>
                  }
                />
              ))}
              {outgoingContactRequests.map((r) => (
                <PersonRow
                  key={`outgoing-${r.contact_id}`}
                  name={r.other_user.full_name}
                  username={r.other_user.username}
                  avatarUrl={r.other_user.profile_picture}
                  action={
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        link request sent for &ldquo;{r.name}&rdquo;
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => handleCancelOwnLink(r.contact_id)}>
                        <X className="size-4" /> Cancel
                      </Button>
                    </div>
                  }
                />
              ))}
            </div>
          )}

          <div className="mb-6 flex gap-2">
            <Input
              value={newContactName}
              onChange={(e) => setNewContactName(e.target.value)}
              placeholder="Name (e.g. A)..."
              className="rounded-full"
            />
            <Input
              value={newContactRelationship}
              onChange={(e) => setNewContactRelationship(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateContact()}
              placeholder="Relationship (e.g. Son)..."
              className="rounded-full"
            />
            <Button onClick={handleCreateContact} disabled={!newContactName.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </div>

          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No people yet. Add someone you want to tag in entries, even if they don&apos;t have a
              Papymory account.
            </p>
          ) : (
            <ul className="space-y-3">
              {contacts.map((contact) => (
                <li key={contact.id} className="rounded-2xl border border-border bg-card p-4">
                  {editingContactId === contact.id ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={editingContactName}
                        onChange={(e) => setEditingContactName(e.target.value)}
                        placeholder="Name"
                        className="w-32 rounded-full"
                      />
                      <Input
                        value={editingContactRelationship}
                        onChange={(e) => setEditingContactRelationship(e.target.value)}
                        placeholder="Relationship"
                        className="w-32 rounded-full"
                      />
                      <Input
                        value={editingContactHandle}
                        onChange={(e) => setEditingContactHandle(e.target.value)}
                        placeholder="handle"
                        className="w-32 rounded-full"
                      />
                      <Button size="sm" onClick={() => saveEditContact(contact.id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingContactId(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-card-foreground">
                          {contact.name}
                          {contact.relationship && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {contact.relationship}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          @{contact.handle}
                          {contact.link_status === "accepted" && contact.linked_user && (
                            <span className="ml-2 text-logo">Linked to @{contact.linked_user.username}</span>
                          )}
                          {contact.link_status === "pending" && contact.linked_user && (
                            <span className="ml-2">
                              Link pending with @{contact.linked_user.username}
                            </span>
                          )}
                          {!contact.link_status && <span className="ml-2">Placeholder — not linked</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!contact.link_status && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Link to a friend"
                            onClick={() => setLinkingContactId(linkingContactId === contact.id ? null : contact.id)}
                          >
                            <Link2 className="size-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => startEditContact(contact)} title="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteContact(contact.id)}
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {linkingContactId === contact.id && (
                    <div className="mt-3 border-t border-border pt-3">
                      {friends.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          You need to be friends with the real person first.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {friends.map((f) => (
                            <li key={f.id} className="flex items-center justify-between py-1 text-sm">
                              <span className="text-card-foreground">{f.full_name || f.username}</span>
                              <Button size="sm" variant="outline" onClick={() => handleRequestLink(contact.id, f.id)}>
                                Request link
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
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
