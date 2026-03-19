// frontend/src/services/api.ts

// ✅ แก้ไขพอร์ตให้ตรงกับ Docker (9090)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9090";

export interface Entry {
  id: number;
  title: string;
  content: string;
  created_date: string;
  created_by: string;
  images: string[];
}

// 1. ดึงรายการบันทึก (แบบปลอดภัย)
export const getEntries = async (page: number, limit: number, token: string): Promise<Entry[]> => {
  try {
    const res = await fetch(`${API_BASE_URL}/entries?page=${page}&limit=${limit}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      // ถ้า Error (401, 500) ให้ส่ง Array ว่างกลับไป ไม่ให้หน้าจอขาว
      console.error("API Error Status:", res.status);
      return []; 
    }

    const data = await res.json();
    // ✅ มั่นใจว่าต้องส่งกลับเป็น Array เท่านั้น
    return Array.isArray(data) ? data : []; 
  } catch (error) {
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
  if (!response.ok) throw new Error(`Failed to fetch entry: ${response.status}`);
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
  if (!response.ok) throw new Error("Failed to create entry");
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
  if (!response.ok) throw new Error("Failed to update entry");
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
  if (!response.ok) throw new Error("Failed to delete");
  return response.json();
};