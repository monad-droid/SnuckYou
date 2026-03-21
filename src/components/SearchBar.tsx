"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

function looksLikeBarcode(q: string): boolean {
  // UPC/EAN barcodes are 8-14 digits, optionally with leading zeros
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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name, brand, or UPC..."
          disabled={loading}
          className={`w-full bg-card border border-card-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-accent transition-colors ${
            large ? "px-6 py-4 text-lg" : "px-4 py-3 text-base"
          } ${loading ? "opacity-50" : ""}`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`absolute right-2 bg-accent text-black font-semibold rounded-md hover:bg-amber-400 transition-colors ${
            large
              ? "top-2 px-6 py-2 text-base"
              : "top-1.5 px-4 py-1.5 text-sm"
          } ${loading ? "opacity-50" : ""}`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching
            </span>
          ) : (
            "Search"
          )}
        </button>
      </div>
    </form>
  );
}
