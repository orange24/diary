"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getEntry, updateEntry } from "@/services/api";

export default function EditEntryPage() {
  const { id } = useParams();
  const router = useRouter();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEntry = async () => {
      try {
        const entry = await getEntry(Number(id));
        setTitle(entry.title);
        setContent(entry.content);
      } catch (error) {
        console.error(error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    if (id) loadEntry();
  }, [id, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateEntry(Number(id), title, content);
      router.push("/");
      router.refresh();
    } catch (error) {
      alert("Update failed");
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Edit Entry</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block mb-2 font-medium">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
            required
          />
        </div>
        <div>
          <label className="block mb-2 font-medium">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 border rounded-lg h-40 focus:ring-2 focus:ring-blue-500 outline-none text-black"
            required
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
            Update Changes
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/")}
            className="flex-1 bg-gray-200 text-gray-800 p-2 rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}