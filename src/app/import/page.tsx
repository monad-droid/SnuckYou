"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase-auth";
import type { OFFProduct } from "@/lib/openfoodfacts";
import type { ReceiptItem } from "@/lib/receipt-parser";


type MatchResult = {
  item: ReceiptItem;
  product: OFFProduct | null;
  confirmed: boolean;
};

type Step = "upload" | "matching" | "review";

export default function ImportPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [step, setStep] = useState<Step>("upload");
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then((res: { data: { user: { id: string } | null } }) => {
      setUser(res.data.user ? { id: res.data.user.id } : null);
      setAuthLoading(false);
    });
  }, [supabase.auth]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF receipt.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      if (data.items.length === 0) {
        setError("No product UPCs found in this receipt. Make sure it's a grocery receipt with barcodes.");
        return;
      }
      setItems(data.items);
      startLookup(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse receipt");
    }
  }, []);

  const startLookup = async (receiptItems: ReceiptItem[]) => {
    setStep("matching");
    setProgress(0);
    const results: MatchResult[] = [];
    const batchSize = 10;

    for (let i = 0; i < receiptItems.length; i += batchSize) {
      const batch = receiptItems.slice(i, i + batchSize);
      const barcodes = batch.map((item) => item.upc);

      try {
        const res = await fetch("/api/import/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcodes }),
        });
        const data = await res.json();

        for (const result of data.results) {
          const item = batch.find((b) => b.upc === result.barcode)!;
          results.push({
            item,
            product: result.product,
            confirmed: true, // Auto-confirm all receipt items
          });
        }
      } catch {
        // If lookup fails, still add items
        for (const item of batch) {
          results.push({ item, product: null, confirmed: true });
        }
      }

      setProgress(Math.min(i + batchSize, receiptItems.length));
    }

    setMatches(results);
    setStep("review");
  };

  const toggleConfirm = (index: number) => {
    setMatches((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, confirmed: !m.confirmed } : m
      )
    );
  };

  const saveWatchlist = async () => {
    const confirmed = matches.filter((m) => m.confirmed);
    if (confirmed.length === 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: confirmed.map((m) => ({
            barcode: m.product?.code || m.item.upc,
            product_name: m.product?.product_name || null,
            brand: m.product?.brands || null,
            image_url:
              m.product?.image_front_url ||
              m.product?.image_url ||
              null,
            receipt_name: m.item.name,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      router.push("/my-products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  };

  const confirmedCount = matches.filter((m) => m.confirmed).length;
  const foundCount = matches.filter((m) => m.product).length;

  // Auth gate
  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center text-on-surface-variant">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-4">
          Sign in to Import Receipts
        </h1>
        <p className="text-on-surface-variant mb-6">
          Create an account to import your grocery receipts and track ingredient changes on products you buy.
        </p>
        <button
          onClick={() =>
            supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: `${window.location.origin}/auth/callback?next=/import`,
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-headline text-4xl font-extrabold text-on-surface mb-2">
        Import Receipt
      </h1>
      <p className="text-on-surface-variant mb-8">
        Upload a grocery receipt PDF to find and track your purchased products.
      </p>

      {error && (
        <div className="bg-error-container text-on-error-container px-4 py-3 rounded-xl mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer ${
            dragging
              ? "border-primary bg-primary-fixed/20"
              : "border-outline-variant hover:border-primary/50"
          }`}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFile(file);
            };
            input.click();
          }}
        >
          <span className="material-symbols-outlined text-5xl text-primary/60 mb-4 block">
            upload_file
          </span>
          <p className="font-headline font-bold text-lg text-on-surface mb-1">
            Drop your receipt PDF here
          </p>
          <p className="text-on-surface-variant text-sm">
            or click to browse — works with Meijer, Walmart, Target, and other grocery receipts
          </p>
        </div>
      )}

      {/* Step 2: Matching */}
      {step === "matching" && (
        <div className="text-center py-16">
          <p className="font-headline font-bold text-lg text-on-surface mb-4">
            Looking up products...
          </p>
          <div className="w-full bg-surface-container rounded-full h-3 mb-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-300"
              style={{
                width: `${items.length > 0 ? (progress / items.length) * 100 : 0}%`,
              }}
            />
          </div>
          <p className="text-on-surface-variant text-sm">
            {progress} of {items.length} products checked
          </p>
        </div>
      )}

      {/* Step 3: Review */}
      {step === "review" && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-on-surface-variant text-sm">
              Found <strong className="text-on-surface">{foundCount}</strong> of{" "}
              {matches.length} products in our database
            </p>
            <button
              onClick={() => {
                setStep("upload");
                setItems([]);
                setMatches([]);
                setError(null);
              }}
              className="text-sm text-primary font-medium hover:underline"
            >
              Upload another receipt
            </button>
          </div>

          <div className="space-y-3">
            {matches.map((match, i) => (
              <div
                key={match.item.upc}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  match.confirmed && match.product
                    ? "border-primary/30 bg-primary-fixed/10"
                    : "border-outline-variant/50 bg-white"
                }`}
              >
                {/* Product image */}
                <div className="w-14 h-14 rounded-lg bg-surface-container overflow-hidden flex-shrink-0">
                  {match.product?.image_front_url || match.product?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(match.product.image_front_url || match.product.image_url)!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-xl">
                        {match.product ? "inventory_2" : "help_outline"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  {match.product ? (
                    <>
                      <p className="font-bold text-on-surface truncate">
                        {match.product.product_name || match.item.name}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">
                        {match.product.brands || "Unknown brand"} · {match.item.upc}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-on-surface-variant truncate">
                        {match.item.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {match.item.upc} · Not found in database
                      </p>
                    </>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggleConfirm(i)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    match.confirmed
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {match.confirmed ? "check" : "close"}
                  </span>
                </button>
              </div>
            ))}
          </div>

          {confirmedCount > 0 && (
            <div className="mt-8 sticky bottom-6">
              <button
                onClick={saveWatchlist}
                disabled={saving}
                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold text-lg hover:bg-primary-container transition-colors disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : `Add ${confirmedCount} product${confirmedCount > 1 ? "s" : ""} to My Products`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
