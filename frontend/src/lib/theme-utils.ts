// frontend/src/lib/theme-utils.ts
export function getWeeklyTheme() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  
  // คำนวณเลขสัปดาห์ (1-52)
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  // สมมติเรามี 4 themes หลัก วนลูปไปเรื่อยๆ
  const themeIndex = (weekNumber % 4) + 1; 
  return `week-${themeIndex}`;
}