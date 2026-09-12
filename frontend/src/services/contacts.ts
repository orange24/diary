import { apiError } from "@/lib/api-error"
import { FriendUser } from "@/services/friends"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090"

// A placeholder person the owner can @-mention without them needing a
// Papymory account (e.g. "son A"). link_status is null (never linked),
// "pending" (link requested, awaiting the other side's approval), or
// "accepted" (linked for real — tagging this contact now surfaces posts in
// linked_user's own feed exactly like a real @username mention).
export interface Contact {
  id: number
  name: string
  handle: string
  relationship: string
  link_status: "pending" | "accepted" | null
  linked_user?: FriendUser
}

export interface ContactLinkRequestItem {
  contact_id: number
  name: string
  relationship: string
  direction: "incoming" | "outgoing"
  other_user: FriendUser
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

export const getContacts = (token: string): Promise<Contact[]> => authFetch("/contacts", token)

export const createContact = (name: string, relationship: string, token: string): Promise<Contact> =>
  authFetch("/contacts", token, { method: "POST", body: JSON.stringify({ name, relationship }) })

export const updateContact = (
  contactId: number,
  data: { name: string; relationship: string; handle?: string },
  token: string
) => authFetch(`/contacts/${contactId}`, token, { method: "PUT", body: JSON.stringify(data) })

export const deleteContact = (contactId: number, token: string) =>
  authFetch(`/contacts/${contactId}`, token, { method: "DELETE" })

export const requestContactLink = (contactId: number, targetUserId: number, token: string) =>
  authFetch(`/contacts/${contactId}/link`, token, {
    method: "POST",
    body: JSON.stringify({ target_user_id: targetUserId }),
  })

export const acceptContactLink = (contactId: number, token: string) =>
  authFetch(`/contacts/${contactId}/link/accept`, token, { method: "POST" })

export const declineContactLink = (contactId: number, token: string) =>
  authFetch(`/contacts/${contactId}/link/decline`, token, { method: "POST" })

export const getContactLinkRequests = (token: string): Promise<ContactLinkRequestItem[]> =>
  authFetch("/contacts/requests", token)
