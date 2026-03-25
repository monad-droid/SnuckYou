import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: {
    default: "YouSnuck — We watch what they snuck in",
    template: "%s | YouSnuck",
  },
  description:
    "Transparency in every bite. Track ingredient shifts, additive changes, and formula updates across thousands of food brands.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to Google Fonts for faster loading */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Load Google Fonts asynchronously — no preload to avoid stalling page load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Load Google Fonts after first paint
              requestAnimationFrame(function() {
                var fonts = [
                  'https://fonts.googleapis.com/css2?family=Manrope:wght@400;700;800&family=Inter:wght@400;500;600&display=swap',
                  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap'
                ];
                fonts.forEach(function(href) {
                  var link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = href;
                  document.head.appendChild(link);
                });
              });
            `,
          }}
        />
      </head>
      <body className="bg-background font-body text-on-background min-h-screen flex flex-col antialiased">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
