// frontend/src/services/api.ts

import { ScrapbookLayout } from "@/types/scrapbook";
import { ApiError, apiError } from "@/lib/api-error";

// ✅ แก้ไขพอร์ตให้ตรงกับ Docker (9090)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090";

export interface Entry {
  id: number;
  title: string;
  content: string;
  created_date: string;
  created_by: string;
  images: string[];
  layout?: ScrapbookLayout | null;
  // The entry's owner — lets the UI tell its own entries apart from a
  // friend's entry merged into the same feed.
  user_id: number;
  // The author's profile picture, shown next to their name in the feed
  // card's hover overlay. Only populated by getEntries.
  created_by_avatar?: string;
  // The author's public profile slug, used to link their name in the feed
  // card to /<slug>. Only populated by getEntries.
  created_by_slug?: string;
  // Which of the author's friend groups this entry is scoped to —
  // empty/absent means "all friends" (any tagged friend can see it). Only
  // ever populated for the entry's own owner (GetEntry, create/update
  // response), never exposed to other viewers.
  friend_group_ids?: number[];
}

export interface PublicProfile {
  id: number;
  username: string;
  full_name: string;
  profile_picture: string;
  facebook_link: string;
  gmail_link: string;
  apple_id_link: string;
  x_link: string;
  slug: string;
  is_self: boolean;
  is_friend: boolean;
}

export interface PublicProfileResponse {
  profile: PublicProfile;
  entries: Entry[];
}

// Fetch a user's public profile page by their slug (/<slug>) — entries
// come back already filtered server-side by audience/friendship.
export const getPublicProfile = async (slug: string, token: string): Promise<PublicProfileResponse> => {
  const res = await fetch(`${API_BASE_URL}/profile/${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw apiError(errorData, "Failed to load profile");
  }
  return res.json();
};

// 1. ดึงรายการบันทึก (แบบปลอดภัย)
export const getEntries = async (page: number, limit: number, token: string): Promise<Entry[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/entries?page=${page}&limit=${limit}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      // เดิมตรงนี้ return [] เงียบ ๆ เพื่อ "ไม่ให้หน้าจอขาว" แต่ผลคือ session
      // หมดอายุ (401) หน้าตาเหมือนกับ "ยังไม่มีบันทึกสักอัน" เป๊ะ — ผู้ใช้ไม่ถูก
      // พากลับไปหน้า login และไม่มีอะไรบอกว่าเกิดอะไรขึ้น ตอนนี้โยน ApiError
      // เหมือนฟังก์ชันอื่นทั้งไฟล์ แล้วให้ฝั่งที่เรียกตัดสินใจว่าจะทำอะไรต่อ
      const errorData = await res.json().catch(() => null);
      throw apiError(errorData, `Failed to load entries: ${res.status}`, res.status);
    }

    const data = await res.json();
    // ✅ มั่นใจว่าต้องส่งกลับเป็น Array เท่านั้น
    return Array.isArray(data) ? data : []; 
  } catch (error) {
    // A failed response is a decision for the caller (see above); only a
    // genuine network/parse failure still degrades to an empty feed.
    if (error instanceof ApiError) throw error;
    console.error("Network Error:", error);
    return []; // 👈 กันพัง
  }
}

// 2. ดึงข้อมูลบันทึกตัวเดียว
export const getEntry = async (id: number, token: string): Promise<Entry> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, `Failed to fetch entry: ${response.status}`);
  }
  return response.json();
};

// 3. สร้างบันทึกใหม่
export const createEntry = async (data: any, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to create entry");
  }
  return response.json();
};

// 4. อัปเดตบันทึก
export const updateEntry = async (id: number, data: any, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to update entry");
  }
  return response.json();
};

// 5. ลบบันทึก
export const deleteEntry = async (id: number, token: string): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, "Failed to delete");
  }
  return response.json();
};