import en from "./locales/en.json";
import it from "./locales/it.json";

export const defaultLanguage = "en";
export const defaultNamespace = "translation";

export const resources = {
  en: {
    [defaultNamespace]: en,
  },
  it: {
    [defaultNamespace]: it,
  },
} as const;

export type SupportedLanguage = keyof typeof resources;

export const supportedLanguages = Object.keys(resources) as SupportedLanguage[];

interface LocaleCandidate {
  languageCode?: string | null;
  languageTag?: string | null;
}

const supportedLanguageSet = new Set<string>(supportedLanguages);

export function resolveLanguage(
  locales: readonly LocaleCandidate[] = [],
): SupportedLanguage {
  for (const locale of locales) {
    const language =
      locale.languageCode ?? locale.languageTag?.split("-").at(0) ?? null;

    if (language !== null && supportedLanguageSet.has(language)) {
      return language as SupportedLanguage;
    }
  }

  return defaultLanguage;
}

export function normalizeLanguage(language?: string | null): SupportedLanguage {
  if (language === undefined || language === null) {
    return defaultLanguage;
  }

  const languageCode = language.split("-").at(0);

  if (languageCode !== undefined && supportedLanguageSet.has(languageCode)) {
    return languageCode as SupportedLanguage;
  }

  return defaultLanguage;
}
