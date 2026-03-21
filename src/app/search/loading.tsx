export default function SearchLoading() {
  return (
    <div className="space-y-6">
      {/* Search bar placeholder */}
      <div className="w-full max-w-2xl">
        <div className="h-12 bg-card border border-card-border rounded-lg animate-pulse" />
      </div>

      <p className="text-sm text-muted">Searching...</p>

      {/* Skeleton grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-lg overflow-hidden"
          >
            <div className="w-full h-40 bg-card-border/30 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-card-border/30 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-card-border/30 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
