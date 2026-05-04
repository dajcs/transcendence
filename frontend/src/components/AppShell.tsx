"use client";

import { useAuthStore } from "@/store/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <div className={isAuthenticated ? "md:ml-[220px]" : ""}>
      <main className={`max-w-4xl mx-auto px-4 pb-8 ${isAuthenticated ? "pt-14 md:pt-8" : "pt-8"}`}>
        {children}
      </main>
    </div>
  );
}
