import { create } from "zustand";

export type Locale = "en" | "fr" | "de";

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("locale");
  if (stored === "en" || stored === "fr" || stored === "de") return stored;
  const browser = navigator.language.slice(0, 2);
  if (browser === "fr") return "fr";
  if (browser === "de") return "de";
  return "en";
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    localStorage.setItem("locale", locale);
    document.documentElement.lang = locale;
    set({ locale });
  },
}));
