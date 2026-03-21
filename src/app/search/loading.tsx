export default function SearchLoading() {
  return (
    <div className="py-24 max-w-7xl mx-auto px-6">
      <div className="mb-12">
        <div className="h-8 w-48 bg-surface-container-high rounded mb-2 animate-pulse" />
        <div className="h-4 w-64 bg-surface-container-high rounded animate-pulse" />
      </div>

      <div className="mb-8">
        <div className="h-14 bg-surface-container-lowest rounded-full animate-pulse ring-1 ring-outline-variant/15" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-square rounded-2xl bg-surface-container-high mb-4" />
            <div className="h-4 w-3/4 bg-surface-container-high rounded mb-2" />
            <div className="h-3 w-1/2 bg-surface-container-high rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
