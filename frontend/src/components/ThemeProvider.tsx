"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/theme";
import { useLocaleStore } from "@/store/locale";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const locale = useLocaleStore((s) => s.locale);
  // Keep DOM class in sync (handles SSR mismatch after hydration)
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Sync the root lang attribute after hydration so Chrome/a11y tools see the active locale.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <>{children}</>;
}
