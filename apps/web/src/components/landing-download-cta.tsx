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

type LandingDownloadCtaProps = {
  downloadLabel: string;
  language: SupportedLanguage;
  subtitle: string;
  title: string;
};

export function LandingDownloadCta({
  title,
  subtitle,
  downloadLabel,
  language,
}: LandingDownloadCtaProps) {
  const badges = downloadBadges[language];

  return (
    <section id="download" className="mx-auto w-11/12 pb-20 lg:w-2/3 lg:pb-28">
      <div className="border-border flex flex-col gap-6 border-t py-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-md space-y-3">
          <h2 className="font-serif text-xl lg:text-2xl">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <div
          aria-label={downloadLabel}
          role="group"
          className="flex flex-wrap items-center gap-3"
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
    </section>
  );
}
