"use client";

import { useAuthStore } from "@/store/auth";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <div className={isAuthenticated ? "md:ml-[220px]" : ""}>
      {children}
    </div>
  );
}
