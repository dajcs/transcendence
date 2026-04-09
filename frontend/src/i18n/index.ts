import { useLocaleStore } from "@/store/locale";
import type { TranslationKey } from "./en";
import en from "./en";

const dictionaries: Record<string, Record<string, string>> = { en };

async function loadDictionary(locale: string): Promise<Record<string, string>> {
  if (dictionaries[locale]) return dictionaries[locale];
  if (locale === "fr") {
    const mod = await import("./fr");
    dictionaries.fr = mod.default;
    return mod.default;
  }
  if (locale === "de") {
    const mod = await import("./de");
    dictionaries.de = mod.default;
    return mod.default;
  }
  return en;
}

let loaded: Record<string, boolean> = { en: true };

export function useT() {
  const locale = useLocaleStore((s) => s.locale);

  // Trigger lazy load (non-blocking)
  if (!loaded[locale]) {
    loaded[locale] = true;
    loadDictionary(locale).then(() => {
      // Force re-render by touching the store
      useLocaleStore.getState().setLocale(locale);
    });
  }

  const dict = dictionaries[locale] ?? en;

  function t(key: TranslationKey, replacements?: Record<string, string | number>): string {
    let text = dict[key] ?? en[key] ?? key;
    if (replacements) {
      for (const [k, v] of Object.entries(replacements)) {
        text = text.replace(`{${k}}`, String(v));
      }
    }
    return text;
  }

  return t;
}

export type { TranslationKey };
