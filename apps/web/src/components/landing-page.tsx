import type { SupportedLanguage } from "@prossimo-app/localization/server";

import { Translator } from "~/utils/types";
import { Footer } from "./footer";
import { LandingDownloadCta } from "./landing-download-cta";
import { LandingFaq } from "./landing-faq";
import { LandingFeatures } from "./landing-features";
import { LandingHero } from "./landing-hero";
import { Navbar } from "./navbar";

export function LandingPage({
  language,
  t,
}: {
  language: SupportedLanguage;
  t: Translator;
}) {
  return (
    <>
      <Navbar
        downloadButtonLabel={t("web.downloadButton")}
        language={language}
        languageSelectLabel={t("settings.language.accessibilityLabel")}
      />
      <LandingHero
        ctaLabel={t("web.downloadButton")}
        imageAlt={t("web.hero.imageAlt")}
        language={language}
        legalDisclaimer={t("web.hero.legalDisclaimer")}
        subtitle={t("web.hero.subtitle")}
        title={t("web.hero.title")}
      />
      <LandingFeatures
        title={t("web.features.title")}
        subtitle={t("web.features.subtitle")}
        features={[
          {
            title: t("web.features.nearbyStops.title"),
            body: t("web.features.nearbyStops.body"),
            imageAlt: t("web.features.nearbyStops.imageAlt"),
            imageSrc: "/landing/features/nearby-stops.png",
            imageWidth: 1170,
            imageHeight: 2532,
            size: "large",
            tone: "blue",
          },
          {
            title: t("web.features.liveArrivals.title"),
            body: t("web.features.liveArrivals.body"),
            imageAlt: t("web.features.liveArrivals.imageAlt"),
            imageSrc: "/landing/features/live-arrivals.png",
            imageWidth: 1170,
            imageHeight: 2532,
            size: "small",
            tone: "green",
          },
          {
            title: t("web.features.savedLines.title"),
            body: t("web.features.savedLines.body"),
            imageAlt: t("web.features.savedLines.imageAlt"),
            imageSrc: "/landing/features/line-detail.png",
            imageWidth: 1206,
            imageHeight: 2622,
            size: "small",
            tone: "rose",
          },
          {
            title: t("web.features.clearSearch.title"),
            body: t("web.features.clearSearch.body"),
            imageAlt: t("web.features.clearSearch.imageAlt"),
            imageSrc: "/landing/features/search-lines.png",
            imageWidth: 1170,
            imageHeight: 2532,
            size: "medium",
            tone: "yellow",
          },
        ]}
      />
      <LandingFaq
        title={t("web.faq.title")}
        subtitle={t("web.faq.subtitle")}
        items={[
          {
            value: "coverage",
            question: t("web.faq.coverage.question"),
            answer: t("web.faq.coverage.answer"),
          },
          {
            value: "realtime",
            question: t("web.faq.realtime.question"),
            answer: t("web.faq.realtime.answer"),
          },
          {
            value: "location",
            question: t("web.faq.location.question"),
            answer: t("web.faq.location.answer"),
          },
          {
            value: "price",
            question: t("web.faq.price.question"),
            answer: t("web.faq.price.answer"),
          },
        ]}
      />
      <LandingDownloadCta
        downloadLabel={t("web.downloadButton")}
        language={language}
        title={t("web.cta.title")}
        subtitle={t("web.cta.subtitle")}
      />
      <Footer
        linksLabel={t("web.footer.links")}
        legalLabel={t("settings.sections.legal")}
        privacyPolicyLabel={t("settings.legal.privacyPolicy")}
        termsOfUseLabel={t("settings.legal.termsOfUse")}
        navigationLinks={[
          {
            href: "#features",
            label: t("web.footer.features"),
          },
          {
            href: "#faq",
            label: t("web.footer.faq"),
          },
          {
            href: "#download",
            label: t("web.footer.download"),
          },
        ]}
      />
    </>
  );
}
