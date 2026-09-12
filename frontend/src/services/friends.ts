import { apiError } from "@/lib/api-error"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"

export interface FriendUser {
  id: number
  username: string
  full_name: string
  profile_picture: string
}

export interface FriendListItem extends FriendUser {
  friendship_id: number
}

// "incoming" (someone sent it to us, waiting on our accept/decline) |
// "outgoing" (we sent it, waiting on the other person)
export interface FriendRequestItem {
  id: number
  direction: "incoming" | "outgoing"
  user: FriendUser
}

// A group is private to its owner — the friends inside it are never told
// which group they're in, only whether a given post is visible to them.
export interface FriendGroup {
  id: number
  name: string
  members: FriendUser[]
}

export type Relationship = "none" | "friends" | "outgoing" | "incoming"

export interface UserSearchResult extends FriendUser {
  relationship: Relationship
  friendship_id?: number
}

async function authFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw apiError(data, `Request failed (${res.status})`)
  }
  return res.json()
}

export const searchUsers = (q: string, token: string): Promise<UserSearchResult[]> =>
  authFetch(`/users/search?q=${encodeURIComponent(q)}`, token)

export const getFriends = (token: string): Promise<FriendListItem[]> => authFetch("/friends", token)

export const getFriendRequests = (token: string): Promise<FriendRequestItem[]> =>
  authFetch("/friends/requests", token)

export const sendFriendRequest = (addresseeId: number, token: string) =>
  authFetch("/friends/request", token, {
    method: "POST",
    body: JSON.stringify({ addressee_id: addresseeId }),
  })

export const acceptFriendRequest = (friendshipId: number, token: string) =>
  authFetch(`/friends/${friendshipId}/accept`, token, { method: "POST" })

export const removeFriendship = (friendshipId: number, token: string) =>
  authFetch(`/friends/${friendshipId}`, token, { method: "DELETE" })

export const getFriendGroups = (token: string): Promise<FriendGroup[]> => authFetch("/friend-groups", token)

export const createFriendGroup = (name: string, token: string): Promise<FriendGroup> =>
  authFetch("/friend-groups", token, { method: "POST", body: JSON.stringify({ name }) })

export const renameFriendGroup = (groupId: number, name: string, token: string) =>
  authFetch(`/friend-groups/${groupId}`, token, { method: "PUT", body: JSON.stringify({ name }) })

export const deleteFriendGroup = (groupId: number, token: string) =>
  authFetch(`/friend-groups/${groupId}`, token, { method: "DELETE" })

export const addGroupMember = (groupId: number, friendUserId: number, token: string) =>
  authFetch(`/friend-groups/${groupId}/members`, token, {
    method: "POST",
    body: JSON.stringify({ friend_user_id: friendUserId }),
  })

export const removeGroupMember = (groupId: number, friendUserId: number, token: string) =>
  authFetch(`/friend-groups/${groupId}/members/${friendUserId}`, token, { method: "DELETE" })
