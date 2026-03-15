// frontend/src/services/api.ts

if (!process.env.API_BASE_URL) {
  console.warn("Warning: API_BASE_URL is not defined in environment variables");
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export interface Entry {
  id: number;
  title: string;
  content: string;
  created_date: string; // เปลี่ยนจาก created_at เป็น created_date ตามหลังบ้าน
  created_by: string;
  images: string[];
}

// 1. ดึงรายการบันทึก
export const getEntries = async (page: number, limit: number, token: string) => {
  const res = await fetch(`${API_BASE_URL}/entries?page=${page}&limit=${limit}`, {
    headers: {
      "Authorization": `Bearer ${token}` // ส่ง Token ไปยืนยันตัวตน
    }
  })
  return res.json()
}

// 2. ดึงข้อมูลบันทึกตัวเดียว
export const getEntry = async (id: number, token: string): Promise<Entry> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error("Failed to fetch entry");
  return response.json();
};

// 3. สร้างบันทึกใหม่
export const createEntry = async (data: { 
  title: string; 
  content: string; 
  created_by: string; 
  images: string[] 
}, token: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to fetch entry");
  return response.json();
};

// 4. อัปเดตบันทึก
export const updateEntry = async (
  id: number, 
  data: { title: string; content: string; created_by: string; images: string[] }
  , token: string
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "PUT", // หรือ PATCH ตามที่ Backend ออกแบบไว้
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) throw new Error("Failed to fetch entry");
  return response.json();
};

// 5. ลบบันทึก
export const deleteEntry = async (id: number, token: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });
  if (!response.ok) throw new Error("Failed to delete");
  return response.json();
};