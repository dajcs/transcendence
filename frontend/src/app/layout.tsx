import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/nav/TopNav";
import AuthBootstrap from "@/components/AuthBootstrap";
import QueryProvider from "@/components/QueryProvider";
import ThemeProvider from "@/components/ThemeProvider";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Vox Populi",
  description: "Reputation-based prediction markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100" suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider>
            <AuthBootstrap />
            <TopNav />
            <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
            <footer className="border-t border-gray-200 dark:border-gray-700 mt-8 py-4">
              <div className="max-w-4xl mx-auto px-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                <Link href="/terms" className="hover:underline">Terms of Service</Link>
              </div>
            </footer>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
