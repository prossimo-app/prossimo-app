import en from "@prossimo-app/localization/locales/en.json" with { type: "json" };
import it from "@prossimo-app/localization/locales/it.json" with { type: "json" };

type TranslationPrimitive = string | number | boolean;
type TranslationValues = Record<string, TranslationPrimitive>;
interface TranslationNode {
  [key: string]: TranslationNode | string;
}

const resources: Record<"en" | "it", TranslationNode> = {
  en,
  it,
};

export type SupportedLanguage = keyof typeof resources;

export const defaultLanguage: SupportedLanguage = "en";

const supportedLanguageSet = new Set<string>(Object.keys(resources));

export function normalizeLanguage(language?: string | null): SupportedLanguage {
  if (language === undefined || language === null) {
    return defaultLanguage;
  }

  const languageCode = language.trim().split("-").at(0)?.toLowerCase();

  if (languageCode !== undefined && supportedLanguageSet.has(languageCode)) {
    return languageCode as SupportedLanguage;
  }

  return defaultLanguage;
}

export function parseAcceptLanguage(header?: string | null) {
  if (!header) {
    return null;
  }

  return header.split(",").at(0)?.split(";").at(0)?.trim() ?? null;
}

function resolveNestedValue(resource: TranslationNode, key: string) {
  const value = key
    .split(".")
    .reduce<TranslationNode | string | undefined>((currentValue, keyPart) => {
      if (typeof currentValue !== "object") {
        return undefined;
      }

      return currentValue[keyPart];
    }, resource);

  return typeof value === "string" ? value : undefined;
}

function resolveTranslationValue(language: SupportedLanguage, key: string) {
  return (
    resolveNestedValue(resources[language], key) ??
    resolveNestedValue(resources[defaultLanguage], key) ??
    key
  );
}

function interpolateTranslation(
  translation: string,
  values: TranslationValues = {},
) {
  return translation.replaceAll(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key];

    return value === undefined ? match : String(value);
  });
}

export type Translator = (key: string, values?: TranslationValues) => string;

export function createTranslator(language?: string | null): Translator {
  const resolvedLanguage = normalizeLanguage(language);

  return function translate(key, values) {
    return interpolateTranslation(
      resolveTranslationValue(resolvedLanguage, key),
      values,
    );
  };
}
