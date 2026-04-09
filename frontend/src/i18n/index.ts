import { useLocaleStore } from "@/store/locale";
import type { TranslationKey } from "./en";
import en from "./en";
import fr from "./fr";
import de from "./de";

const dictionaries: Record<string, Record<string, string>> = { en, fr, de };

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
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
