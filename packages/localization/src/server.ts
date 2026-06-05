import type { SupportedLanguage } from "./core";
import {
  defaultLanguage,
  defaultNamespace,
  normalizeLanguage,
  resources,
} from "./core";

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

type TranslationPrimitive = string | number | boolean;
type TranslationValues = Record<string, TranslationPrimitive>;
interface TranslationNode {
  [key: string]: TranslationNode | string;
}

function resolveTranslationValue(
  language: SupportedLanguage,
  key: string,
): string {
  const fallbackResource = resources[defaultLanguage][defaultNamespace];
  const languageResource = resources[language][defaultNamespace];

  return (
    resolveNestedValue(languageResource, key) ??
    resolveNestedValue(fallbackResource, key) ??
    key
  );
}

function resolveNestedValue(resource: TranslationNode, key: string) {
  const value = key
    .split(".")
    .reduce<TranslationNode | string | undefined>((currentValue, keyPart) => {
      if (typeof currentValue !== "object" || currentValue === null) {
        return undefined;
      }

      return currentValue[keyPart];
    }, resource);

  return typeof value === "string" ? value : undefined;
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

export function createTranslator(language?: string | null) {
  const resolvedLanguage = normalizeLanguage(language);

  return function translate(key: string, values?: TranslationValues) {
    return interpolateTranslation(
      resolveTranslationValue(resolvedLanguage, key),
      values,
    );
  };
}
