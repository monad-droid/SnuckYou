export default function ProductLoading() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Photo skeleton */}
          <div className="lg:w-1/2 space-y-6">
            <div className="aspect-square rounded-3xl bg-surface-container-high animate-pulse" />
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-surface-container-high animate-pulse" />
              ))}
            </div>
          </div>

          {/* Details skeleton */}
          <div className="lg:w-1/2">
            <div className="mb-8">
              <div className="h-4 w-24 bg-surface-container-high rounded mb-4 animate-pulse" />
              <div className="h-10 w-3/4 bg-surface-container-high rounded mb-2 animate-pulse" />
              <div className="h-6 w-1/3 bg-surface-container-high rounded mb-6 animate-pulse" />
              <div className="flex gap-4 py-4 border-y border-outline-variant/10">
                <div className="h-12 w-20 bg-surface-container-high rounded animate-pulse" />
                <div className="h-12 w-32 bg-surface-container-high rounded animate-pulse" />
              </div>
            </div>

            <div className="mb-12">
              <div className="h-6 w-40 bg-surface-container-high rounded mb-6 animate-pulse" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="h-8 bg-surface-container-high rounded-md animate-pulse" style={{ width: `${60 + Math.random() * 80}px` }} />
                ))}
              </div>
            </div>

            <div>
              <div className="h-6 w-36 bg-surface-container-high rounded mb-6 animate-pulse" />
              <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
                <div className="h-4 w-full bg-surface-container-high rounded mb-2 animate-pulse" />
                <div className="h-4 w-2/3 bg-surface-container-high rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
