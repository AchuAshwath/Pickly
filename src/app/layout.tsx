// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  children: React.ReactNode;
}>) {
  return (
    // Add suppressHydrationWarning={true} here
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Optional: Add ThemeProvider if you configured it */}
        {/* <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
         > */}
           {children}
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}