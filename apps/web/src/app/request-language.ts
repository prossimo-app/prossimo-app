import { resolveLanguage } from "@prossimo-app/localization/server";

interface BrowserLanguageCandidate {
  languageTag: string;
  quality: number;
  index: number;
}

export function resolveRequestLanguage(
  acceptLanguage: string | null,
  selectedLanguage: string | null = null,
) {
  const locales =
    acceptLanguage === null
      ? []
      : acceptLanguage
          .split(",")
          .map((entry, index): BrowserLanguageCandidate | null => {
            const [languageTag, ...parameters] = entry.trim().split(";");

            if (languageTag === undefined || languageTag.length === 0) {
              return null;
            }

            const qualityParameter = parameters.find((parameter) =>
              parameter.trim().startsWith("q="),
            );
            const quality =
              qualityParameter === undefined
                ? 1
                : Number.parseFloat(qualityParameter.trim().slice(2));

            return {
              index,
              languageTag,
              quality: Number.isFinite(quality) ? quality : 0,
            };
          })
          .filter(
            (locale): locale is BrowserLanguageCandidate => locale !== null,
          )
          .sort((firstLocale, secondLocale) => {
            if (firstLocale.quality !== secondLocale.quality) {
              return secondLocale.quality - firstLocale.quality;
            }

            return firstLocale.index - secondLocale.index;
          });

  return resolveLanguage(
    selectedLanguage === null
      ? locales
      : [{ languageTag: selectedLanguage }, ...locales],
  );
}
