"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase-auth";
import WatchlistProductCard, {
  type WatchlistItem,
} from "@/components/WatchlistProductCard";
import Link from "next/link";

export default function MyProductsPage() {
  const supabase = createBrowserClient();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [changeCounts, setChangeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then((res: { data: { user: { id: string } | null } }) => {
      setUser(res.data.user ? { id: res.data.user.id } : null);
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });
  }, [supabase.auth]);

  useEffect(() => {
    if (!user) return;

    fetch("/api/watchlist")
      .then((res) => res.json())
      .then((data) => {
        setWatchlist(data.watchlist || []);
        setChangeCounts(data.changeCounts || {});
      })
      .catch(() => {
        // Watchlist fetch failed — show empty state
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleRemove = async (barcode: string) => {
    // Optimistic update
    setWatchlist((prev) => prev.filter((w) => w.barcode !== barcode));

    await fetch("/api/watchlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
  };

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center text-on-surface-variant">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-4">
          Sign in to See Your Products
        </h1>
        <p className="text-on-surface-variant mb-6">
          Track ingredient changes on products you actually buy.
        </p>
        <button
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback?next=/my-products`,
              },
            })
          }
          className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold hover:bg-primary-container transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center text-on-surface-variant">
        Loading your products...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-headline text-4xl font-extrabold text-on-surface">
            My Products
          </h1>
          <p className="text-on-surface-variant mt-1">
            {watchlist.length} product{watchlist.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <Link
          href="/import"
          className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold text-sm hover:bg-primary-container transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">upload_file</span>
          Import Receipt
        </Link>
      </div>

      {watchlist.length === 0 ? (
        <div className="text-center py-20 bg-surface-container-low rounded-2xl">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant/40 mb-4 block">
            receipt_long
          </span>
          <p className="font-headline font-bold text-lg text-on-surface mb-2">
            No products yet
          </p>
          <p className="text-on-surface-variant mb-6">
            Import a grocery receipt to start tracking ingredient changes on products you buy.
          </p>
          <Link
            href="/import"
            className="inline-block bg-primary text-on-primary px-6 py-3 rounded-full font-bold hover:bg-primary-container transition-colors"
          >
            Import Your First Receipt
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {watchlist.map((item) => (
            <WatchlistProductCard
              key={item.barcode}
              item={item}
              changeCount={changeCounts[item.barcode] || 0}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
