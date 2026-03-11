// frontend/src/app/page.tsx
import { getEntries } from "@/services/api";
import Link from "next/link";
import DeleteButton from "@/components/DeleteButton";

export default async function Home() {
  const entries = await getEntries();

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">My Diary</h1>
        <Link href="/create" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          + Write New
        </Link>
      </div>

      <div className="space-y-4">
        {entries && entries.length > 0 ? (
          entries.map((entry) => (
            <div key={entry.id} className="p-6 border rounded-xl shadow-sm flex justify-between items-start bg-white hover:shadow-md transition-shadow">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-800">{entry.title}</h2>
                <p className="text-gray-600 mt-2 whitespace-pre-wrap">{entry.content}</p>
              </div>

              <div className="flex gap-2">
                <Link 
                  href={`/edit/${entry.id}`}
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                >
                  {/* ไอคอนดินสอ */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </Link>
                <DeleteButton id={entry.id} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-gray-500 py-10">No diary entries found.</p>
        )}
      </div>
    </main>
  );
}