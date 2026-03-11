// frontend/src/services/api.ts
if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
  console.warn("Warning: NEXT_PUBLIC_API_BASE_URL is not defined in environment variables");
}

// Use environment variable from .env.local
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export interface Entry {
  id: number;
  title: string;
  content: string;
}

// Fetch all entries from the Go Backend
export const getEntries = async (): Promise<Entry[]> => {
  const response = await fetch(`${API_BASE_URL}/entries`, {
    cache: 'no-store' // Disable cache to get fresh data
  });
  
  if (!response.ok) {
    throw new Error("Failed to fetch entries");
  }
  
  return response.json();
};

// ... keep existing getEntries function
export const createEntry = async (title: string, content: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content }),
  });

  if (!response.ok) {
    throw new Error("Failed to create entry");
  }
};

export const deleteEntry = async (id: number): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete entry");
  }
};

export const getEntry = async (id: number): Promise<Entry> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`);
  if (!response.ok) throw new Error("Failed to fetch entry");
  return response.json();
};

export const updateEntry = async (id: number, title: string, content: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/entries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content }),
  });
  if (!response.ok) throw new Error("Failed to update entry");
};