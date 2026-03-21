import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-card-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-accent">SnuckYou</span>
        </Link>
        <p className="text-xs text-muted hidden sm:block">
          We watch what they snuck in.
        </p>
      </div>
    </header>
  );
}
