export default function Footer() {
  return (
    <footer className="bg-emerald-50 border-t border-emerald-100 mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-8 py-12 max-w-7xl mx-auto">
        <div className="mb-8 md:mb-0">
          <span className="font-headline font-bold text-emerald-900 text-xl block mb-2">
            YouSnuck
          </span>
          <p className="font-body text-xs tracking-wide uppercase text-emerald-700">
            &copy; 2024 YouSnuck. All rights reserved.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-8">
          <span className="font-body text-xs tracking-wide uppercase text-emerald-700 opacity-80">
            Privacy Policy
          </span>
          <span className="font-body text-xs tracking-wide uppercase text-emerald-700 opacity-80">
            Terms of Service
          </span>
          <span className="font-body text-xs tracking-wide uppercase text-emerald-700 opacity-80">
            Contact Information
          </span>
        </div>
      </div>
    </footer>
  );
}
