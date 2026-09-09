const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"

export interface FriendUser {
  id: number
  username: string
  full_name: string
}

export interface FriendListItem extends FriendUser {
  friendship_id: number
}

export interface FriendRequestItem {
  id: number
  requester: FriendUser
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
    throw new Error(data.error || `Request failed (${res.status})`)
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
