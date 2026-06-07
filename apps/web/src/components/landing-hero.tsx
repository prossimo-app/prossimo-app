import Image from "next/image";
import Link from "next/link";

import type { SupportedLanguage } from "@prossimo-app/localization/server";

const downloadBadges = {
  en: {
    appStoreAlt: "Download on the App Store",
    appStore: "/landing/en-download-app-store.svg",
    googlePlayAlt: "Get it on Google Play",
    googlePlay: "/landing/en-download-google-play.svg",
  },
  it: {
    appStoreAlt: "Scarica su App Store",
    appStore: "/landing/it-download-app-store.svg",
    googlePlayAlt: "Disponibile su Google Play",
    googlePlay: "/landing/it-download-google-play.svg",
  },
} satisfies Record<
  SupportedLanguage,
  {
    appStoreAlt: string;
    appStore: string;

    googlePlayAlt: string;
    googlePlay: string;
  }
>;

interface LandingHeroProps {
  ctaLabel: string;
  imageAlt: string;
  language: SupportedLanguage;
  legalDisclaimer: string;
  subtitle: string;
  title: string;
}

export function LandingHero({
  title,
  subtitle,
  ctaLabel,
  imageAlt,
  language,
  legalDisclaimer,
}: LandingHeroProps) {
  const badges = downloadBadges[language];

  return (
    <section className="mx-auto w-11/12 lg:w-2/3">
      <div className="relative flex flex-col items-center justify-center gap-8 pt-32 pb-16 lg:min-h-screen lg:flex-row lg:py-0">
        <div className="flex-1 space-y-4">
          <p className="text-muted-foreground max-w-sm text-xs">
            {legalDisclaimer}
          </p>
          <h1 className="max-w-md font-serif text-xl lg:text-2xl">{title}</h1>
          <p className="text-muted-foreground max-w-sm">{subtitle}</p>
          <div
            aria-label={ctaLabel}
            role="group"
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <Link
              href="https://apps.apple.com/app/prossimo-torino/id6449075833"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={badges.appStore}
                width={120}
                height={40}
                alt={badges.appStoreAlt}
                draggable={false}
                className="h-10 w-auto select-none"
              />
            </Link>
            <Link
              href="https://play.google.com/store/apps/details?id=app.prossimo.app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={badges.googlePlay}
                width={135}
                height={40}
                alt={badges.googlePlayAlt}
                draggable={false}
                className="h-10 w-auto select-none"
              />
            </Link>
          </div>
        </div>

        <Image
          src="/landing/hero-image-phone.png"
          quality={100}
          width={600}
          height={500}
          alt={imageAlt}
          draggable={false}
          className="select-none lg:absolute lg:right-0"
        />
      </div>
    </section>
  );
}
