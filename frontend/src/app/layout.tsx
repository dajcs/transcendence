import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/nav/TopNav";
import AuthBootstrap from "@/components/AuthBootstrap";
import QueryProvider from "@/components/QueryProvider";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Vox Populi",
  description: "Reputation-based prediction markets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 dark:bg-slate-900 dark:text-gray-100" suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <AuthBootstrap />
            <TopNav />
            <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
