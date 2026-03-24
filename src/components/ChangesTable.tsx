"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IngredientChange } from "@/lib/supabase";
import { summarizeChange } from "@/lib/diff";

type VerdictFilter = "" | "Health Concern" | "Cost Cutting" | "Consumer Benefit" | "Neutral";
type SortOption = "newest" | "oldest" | "risk";

const VERDICT_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  "Health Concern": { bg: "bg-error/10", text: "text-error", icon: "report" },
  "Cost Cutting": { bg: "bg-amber-100", text: "text-amber-800", icon: "warning" },
  "Consumer Benefit": { bg: "bg-green-100", text: "text-green-800", icon: "verified" },
  Neutral: { bg: "bg-gray-100", text: "text-gray-600", icon: "info" },
};

function formatDate(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
  };
}

function parseChangeSummary(summary: string): { added: string[]; removed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const addedMatch = summary.match(/Added: ([^·]+)/);
  const removedMatch = summary.match(/Removed: ([^·]+)/);
  if (addedMatch) added.push(...addedMatch[1].split(", ").map((s) => s.trim()).filter(Boolean));
  if (removedMatch) removed.push(...removedMatch[1].split(", ").map((s) => s.trim()).filter(Boolean));
  return { added, removed };
}

export default function ChangesTable({
  initialChanges,
  initialTotalCount,
}: {
  initialChanges: IngredientChange[];
  initialTotalCount: number;
}) {
  const [changes, setChanges] = useState<IngredientChange[]>(initialChanges);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotalCount / 25));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const [verdict, setVerdict] = useState<VerdictFilter>("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchChanges = useCallback(async (p: number, ps: number, s: string, v: VerdictFilter, so: SortOption) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(ps),
        sort: so,
      });
      if (s) params.set("search", s);
      if (v) params.set("verdict", v);

      const res = await fetch(`/api/changes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setChanges(data.changes);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when filters change (reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchChanges(1, pageSize, debouncedSearch, verdict, sort);
  }, [debouncedSearch, verdict, sort, pageSize, fetchChanges]);

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    fetchChanges(p, pageSize, debouncedSearch, verdict, sort);
  }

  function getPageNumbers(): (number | "...")[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [];
    if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, "...", totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  }

  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <>
      {/* Search and Filter Bar */}
      <section className="bg-surface-container-low p-6 mb-8 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[300px] relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container-lowest border-none py-3 pl-12 pr-4 rounded text-sm focus:ring-1 focus:ring-primary shadow-sm"
            placeholder="Filter by Product, Brand, or UPC..."
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/50 mr-2">
            AI Verdict:
          </span>
          {(
            [
              { key: "Health Concern", label: "Critical", active: "bg-error text-on-error" },
              { key: "Cost Cutting", label: "Warning", active: "bg-amber-600 text-white" },
              { key: "Consumer Benefit", label: "Benefit", active: "bg-green-700 text-white" },
              { key: "Neutral", label: "Neutral", active: "bg-gray-700 text-white" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setVerdict(verdict === f.key ? "" : f.key)}
              className={`px-4 py-2 text-xs font-bold rounded transition-colors ${
                verdict === f.key
                  ? f.active
                  : "bg-surface-container-high text-primary/70 hover:bg-surface-container-highest"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/50">
            Sort By:
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="bg-surface-container-lowest border-none text-xs font-bold py-2 pl-3 pr-8 rounded focus:ring-0 cursor-pointer shadow-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="risk">Highest Risk</option>
          </select>
        </div>
      </section>

      {/* Data Table */}
      <div className="bg-surface-container-lowest overflow-x-auto shadow-[0_4px_20px_-4px_rgba(1,45,29,0.05)]">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-surface-container text-[10px] font-bold uppercase tracking-[0.15em] text-primary/60">
              <th className="px-6 py-4">Product Identity</th>
              <th className="px-6 py-4">Ingredient Shift</th>
              <th className="px-6 py-4">AI Risk Assessment</th>
              <th className="px-6 py-4 text-right">Detection Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low font-body">
            {loading && changes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-on-surface-variant">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && changes.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-16 text-center text-on-surface-variant">
                  <p className="text-lg font-headline font-bold mb-1">No changes found</p>
                  <p className="text-sm">Try adjusting your search or filters.</p>
                </td>
              </tr>
            )}
            {changes.map((change) => {
              const summary =
                change.ingredients_before && change.ingredients_after
                  ? summarizeChange(change.ingredients_before, change.ingredients_after)
                  : "Ingredients changed";
              const { added, removed } = parseChangeSummary(summary);
              const verdictStyle = change.ai_verdict_category
                ? VERDICT_STYLES[change.ai_verdict_category]
                : null;
              const dt = change.detected_at ? formatDate(change.detected_at) : null;
              const showVerdict =
                verdictStyle &&
                (change.ai_verdict_confidence === null || change.ai_verdict_confidence >= 40);

              return (
                <tr
                  key={change.id}
                  className="hover:bg-surface-container-low/30 transition-colors group"
                >
                  <td className="px-6 py-5">
                    <Link href={`/product/${change.barcode}`} className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-surface-container rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-primary/20">
                        <span className="material-symbols-outlined text-2xl">inventory_2</span>
                      </div>
                      <div>
                        <h4 className="font-headline text-base font-bold text-primary group-hover:underline">
                          {change.product_name || "Unknown Product"}
                        </h4>
                        <p className="text-xs text-primary/60 font-medium">
                          UPC: {change.barcode}
                        </p>
                        <p className="text-[10px] uppercase font-bold tracking-tight text-secondary">
                          {change.brand || "Unknown Brand"}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      {removed.map((item, i) => (
                        <div key={`rem-${i}`} className="flex items-center gap-2 text-xs">
                          <span
                            className="material-symbols-outlined text-error text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            remove_circle
                          </span>
                          <span className="line-through text-primary/40">{item}</span>
                        </div>
                      ))}
                      {added.map((item, i) => (
                        <div key={`add-${i}`} className="flex items-center gap-2 text-xs">
                          <span
                            className="material-symbols-outlined text-secondary text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            add_circle
                          </span>
                          <span className="font-bold text-primary">{item}</span>
                        </div>
                      ))}
                      {added.length === 0 && removed.length === 0 && (
                        <span className="text-xs text-primary/50">{summary}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {showVerdict ? (
                      <>
                        <span
                          className={`${verdictStyle.bg} ${verdictStyle.text} text-[10px] font-extrabold px-2 py-1 rounded-sm uppercase tracking-widest inline-flex items-center gap-1`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {verdictStyle.icon}
                          </span>
                          {change.ai_verdict_category}
                        </span>
                        {change.ai_verdict_explanation && (
                          <p className="mt-1 text-[10px] text-primary/50 max-w-[220px] line-clamp-2">
                            {change.ai_verdict_explanation}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-primary/30 uppercase tracking-widest">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {dt ? (
                      <>
                        <span className="text-sm font-bold text-primary/80">{dt.date}</span>
                        <p className="text-[10px] text-primary/40">{dt.time}</p>
                      </>
                    ) : (
                      <span className="text-[10px] text-primary/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="p-6 border-t border-surface-container flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-body text-[10px] uppercase font-bold tracking-widest text-primary/40">
            Showing {startItem}-{endItem} of {totalCount.toLocaleString()} investigations
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="w-10 h-10 flex items-center justify-center text-primary/40 hover:text-primary transition-colors disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {getPageNumbers().map((p, i) =>
              p === "..." ? (
                <span key={`dots-${i}`} className="px-2 text-primary/30">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`w-10 h-10 flex items-center justify-center text-sm font-bold rounded-sm transition-all ${
                    p === page
                      ? "bg-brand-highlight text-primary shadow-sm"
                      : "text-primary/60 hover:bg-surface-container"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="w-10 h-10 flex items-center justify-center text-primary/40 hover:text-primary transition-colors disabled:opacity-30"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-body text-[10px] uppercase font-bold tracking-widest text-primary/40">
              Page Size:
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="bg-surface-container-low border-none text-[10px] font-bold py-1 pl-2 pr-6 rounded focus:ring-0 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && changes.length > 0 && (
        <div className="fixed inset-0 bg-background/30 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-surface-container-lowest px-6 py-3 rounded-lg shadow-lg text-sm font-bold text-primary">
            Loading...
          </div>
        </div>
      )}
    </>
  );
}
