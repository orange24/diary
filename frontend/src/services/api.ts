// frontend/src/services/api.ts

if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn("Warning: NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
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
export const getEntries = async (page: number = 1, limit: number = 10): Promise<Entry[]> => {
  const response = await fetch(`${API_BASE_URL}/entries?page=${page}&limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch entries");
  return response.json();
};

// 2. ดึงข้อมูลบันทึกตัวเดียว
export const getEntry = async (id: number): Promise<Entry> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`);
  if (!response.ok) throw new Error("Failed to fetch entry");
  return response.json();
};

// 3. สร้างบันทึกใหม่
export const createEntry = async (data: { 
  title: string; 
  content: string; 
  created_by: string; 
  images: string[] 
}): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create entry");
  }
};

// 4. อัปเดตบันทึก
export const updateEntry = async (
  id: number, 
  data: { title: string; content: string; created_by: string; images: string[] }
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "PUT", // หรือ PATCH ตามที่ Backend ออกแบบไว้
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update entry");
  }
};

// 5. ลบบันทึก
export const deleteEntry = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete entry");
  }
};