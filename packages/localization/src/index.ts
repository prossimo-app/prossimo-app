import type { InitOptions } from "i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import {
  defaultLanguage,
  defaultNamespace,
  normalizeLanguage,
  resolveLanguage,
  resources,
  supportedLanguages,
} from "./core";

export { I18nextProvider, Trans, useTranslation } from "react-i18next";
export { i18n };
export {
  defaultLanguage,
  defaultNamespace,
  normalizeLanguage,
  resources,
  resolveLanguage,
  supportedLanguages,
  type SupportedLanguage,
} from "./core";
export { languageOptions } from "./languages";

interface LocaleCandidate {
  languageCode?: string | null;
  languageTag?: string | null;
}

interface InitializeI18nOptions {
  locales?: readonly LocaleCandidate[];
  language?: string | null;
  options?: InitOptions;
}

export function initializeI18n({
  language,
  locales,
  options,
}: InitializeI18nOptions = {}) {
  const resolvedLanguage =
    language === undefined
      ? resolveLanguage(locales)
      : normalizeLanguage(language);

  if (i18n.isInitialized) {
    if (i18n.language !== resolvedLanguage) {
      void i18n.changeLanguage(resolvedLanguage);
    }

    return i18n;
  }

  void i18n.use(initReactI18next).init({
    compatibilityJSON: "v4",
    defaultNS: defaultNamespace,
    fallbackLng: defaultLanguage,
    interpolation: {
      escapeValue: false,
    },
    lng: resolvedLanguage,
    ns: [defaultNamespace],
    resources,
    supportedLngs: supportedLanguages,
    ...options,
  });

  return i18n;
}
