// ใช้สไตล์ที่คุณถนัด (Fetch API หรือ Axios)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export const login = async (username: string, password: string) => {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Login failed');
        }

     return response.json(); // จะได้รับ { "token": "..." }
    } catch (err) {
        // throw err;
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
    const errorData = await response.json();
    // ดึง Error message ที่ส่งมาจาก Go (gin.H) มาแสดง
    throw new Error(errorData.error || 'Registration failed');
  }

  return response.json();
};