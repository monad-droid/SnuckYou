import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <nav className="flex items-center justify-between w-full px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-2xl font-headline font-extrabold text-emerald-900 tracking-tighter"
          >
            YouSnuck
          </Link>
          <div className="hidden md:flex gap-6 items-center">
            <Link
              href="/"
              className="text-emerald-900 font-bold border-b-2 border-emerald-900 pb-1"
            >
              Browse
            </Link>
            <Link
              href="/changes"
              className="text-emerald-800/70 font-medium pb-1 hover:text-emerald-900 transition-colors duration-200"
            >
              Recent Changes
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden lg:block font-body text-xs tracking-wide uppercase text-emerald-700">
            We watch what{" "}
            <span className="bg-brand-highlight/40 px-1 font-bold">
              they snuck in
            </span>
          </span>
          <Link
            href="/search"
            className="material-symbols-outlined text-primary p-2 hover:bg-surface-container rounded-full transition-all"
          >
            search
          </Link>
        </div>
      </nav>
    </header>
  );
}
