import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/nav/Sidebar";
import AppShell from "@/components/AppShell";
import AuthBootstrap from "@/components/AuthBootstrap";
import QueryProvider from "@/components/QueryProvider";
import ThemeProvider from "@/components/ThemeProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Runs before React hydrates — sets dark class to avoid FOUC
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "Vox Populi",
  description: "Reputation-based prediction markets",
  icons: {
    icon: "/voxpopuli-logo.png",
    shortcut: "/voxpopuli-logo.png",
    apple: "/voxpopuli-logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className="min-h-screen font-sans antialiased bg-[oklch(98%_0.005_250)] dark:bg-[oklch(14%_0.015_250)] text-[#0f0f0f] dark:text-[oklch(95%_0.005_250)]"
        suppressHydrationWarning
      >
        <QueryProvider>
          <ThemeProvider>
            <AuthBootstrap />
            <Sidebar />
            <AppShell>
              {children}
            </AppShell>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
