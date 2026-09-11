// ใช้สไตล์ที่คุณถนัด (Fetch API หรือ Axios)
import { apiError } from "@/lib/api-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const login = async (username: string, password: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw apiError(errorData, 'Login failed');
        }

     return response.json(); // จะได้รับ { "token": "..." }
    } catch (err) {
        throw err;
    }
};

// แก้ไขตรงนี้: รับเป็น Object (userData) เพื่อให้ส่งทุก Field ไปที่ Go ได้
export const register = async (userData: any) => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // ส่ง Object ทั้งก้อนที่รับมาจากหน้า Register ไปที่ Go Backend
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Registration failed');
  }

  return response.json();
};

export interface ProfileData {
  id: number;
  username: string;
  full_name: string;
  birthdate: string;
  gender: string;
  country: string;
  facebook_link: string;
  gmail_link: string;
  apple_id_link: string;
  x_link: string;
  profile_picture: string;
  // Public profile page slug (/<slug>) — server-generated, read-only.
  slug: string;
  locale: string;
}

export const getProfile = async (token: string): Promise<ProfileData> => {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to load profile');
  }
  return response.json();
};

export type ProfileUpdate = Omit<ProfileData, 'id' | 'username' | 'slug'>;

export const updateProfile = async (data: ProfileUpdate, token: string) => {
  const response = await fetch(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to update profile');
  }
  return response.json();
};

export const updateLocale = async (locale: string, token: string) => {
  const response = await fetch(`${API_BASE_URL}/profile/locale`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw apiError(errorData, 'Failed to update language');
  }
  return response.json();
};