"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({
  initialQuery = "",
  large = false,
}: {
  initialQuery?: string;
  large?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product name or brand..."
          className={`w-full bg-card border border-card-border rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-accent transition-colors ${
            large ? "px-6 py-4 text-lg" : "px-4 py-3 text-base"
          }`}
        />
        <button
          type="submit"
          className={`absolute right-2 bg-accent text-black font-semibold rounded-md hover:bg-amber-400 transition-colors ${
            large
              ? "top-2 px-6 py-2 text-base"
              : "top-1.5 px-4 py-1.5 text-sm"
          }`}
        >
          Search
        </button>
      </div>
    </form>
  );
}
