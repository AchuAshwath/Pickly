// src/app/layout.tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ThemeProviders } from "@/components/theme-providers";
import ThemeToggle from "@/components/theme-toggle";
import "./globals.css";
// import { ThemeProvider } from "@/components/theme-provider"; // If you use themes

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Photo Gallery",
  description: "Browse and select photos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    // Add suppressHydrationWarning={true} here
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        {/* Optional: Add ThemeProvider if you configured it */}
        <ThemeProviders>
           <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
             <div className="container mx-auto p-4 flex items-center justify-between">
               <Link href="/" className="font-semibold tracking-tight">Lazy Photo Select</Link>
               <nav className="flex items-center gap-4 text-sm">
                 <Link href="/" className="hover:underline">Home</Link>
                 <Link href="/gallery" className="hover:underline">Gallery</Link>
                <Link href="/donate" className="hover:underline">Support</Link>
                 <ThemeToggle />
               </nav>
             </div>
           </header>
           <main className="flex-1">{children}</main>
           <footer className="border-t">
             <div className="container mx-auto py-3 px-4 text-xs text-muted-foreground flex items-center justify-between">
               <span>© {new Date().getFullYear()} Lazy Photo Select</span>
               <div className="flex items-center gap-4">
                <Link href="/donate" className="hover:underline">Support</Link>
                 <a className="hover:underline" href="https://nextjs.org" target="_blank" rel="noreferrer">Built with Next.js</a>
               </div>
             </div>
           </footer>
        </ThemeProviders>
      </body>
    </html>
  );
}