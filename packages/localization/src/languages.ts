import type { SupportedLanguage } from "./core";

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export const languageOptions = [
  {
    code: "en",
    label: "English",
    nativeLabel: "English",
  },
  {
    code: "it",
    label: "Italian",
    nativeLabel: "Italiano",
  },
] as const satisfies readonly LanguageOption[];
