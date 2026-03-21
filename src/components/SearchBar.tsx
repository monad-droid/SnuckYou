"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

function looksLikeBarcode(q: string): boolean {
  return /^\d{8,14}$/.test(q);
}

export default function SearchBar({
  initialQuery = "",
  large = false,
}: {
  initialQuery?: string;
  large?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);

    if (looksLikeBarcode(trimmed)) {
      router.push(`/product/${encodeURIComponent(trimmed)}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={large ? "max-w-3xl mx-auto" : "max-w-2xl"}>
      <div className="bg-surface-container-lowest rounded-full p-2 flex items-center shadow-xl shadow-primary/5 ring-1 ring-outline-variant/15">
        <span className="material-symbols-outlined px-4 text-outline">search</span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, brand, or UPC..."
          disabled={loading}
          className={`w-full bg-transparent border-none focus:ring-0 focus:outline-none font-body py-3 text-on-surface placeholder-outline ${
            large ? "text-lg" : "text-base"
          } ${loading ? "opacity-50" : ""}`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`bg-primary text-on-primary px-8 py-3 rounded-full font-headline font-bold hover:scale-95 transition-all shrink-0 ${
            loading ? "opacity-50" : ""
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scanning
            </span>
          ) : (
            "Scan"
          )}
        </button>
      </div>
    </form>
  );
}
