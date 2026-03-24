"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

export default function Header() {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return isActive
      ? "text-emerald-900 font-bold border-b-2 border-emerald-900 pb-1"
      : "text-emerald-800/70 font-medium pb-1 hover:text-emerald-900 transition-colors duration-200";
  };

  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <nav className="flex items-center justify-between w-full px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-2xl font-headline font-extrabold text-emerald-900 tracking-tighter"
          >
            You Snuck
          </Link>
          <div className="hidden md:flex gap-6 items-center">
            <Link href="/" className={linkClass("/")}>
              Browse
            </Link>
            <Link href="/changes" className={linkClass("/changes")}>
              Recent Changes
            </Link>
            <Link href="/my-products" className={linkClass("/my-products")}>
              My Products
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
          <AuthButton />
        </div>
      </nav>
    </header>
  );
}
