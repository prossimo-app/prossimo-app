import Link from "next/link";

import type { SupportedLanguage } from "@prossimo-app/localization/server";
import { languageOptions } from "@prossimo-app/localization/server";

import { BrandIcon } from "./brand-icon";
import { DownloadButton } from "./download-button";
import { LanguageSelect } from "./language-select";

const APP_NAME = "Prossimo";

interface NavbarProps {
  downloadButtonLabel: string;
  language: SupportedLanguage;
  languageSelectLabel: string;
}

export function Navbar({
  downloadButtonLabel,
  language,
  languageSelectLabel,
}: NavbarProps) {
  return (
    <header className="fixed z-10 w-full bg-transparent backdrop-blur-md">
      <div className="mx-auto flex h-16 w-11/12 items-center justify-between lg:w-2/3">
        <Link href="/" className="flex items-center gap-2 select-none">
          <BrandIcon alt={APP_NAME} />
          <span className="text-lg font-medium">{APP_NAME}</span>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSelect
            currentLanguage={language}
            label={languageSelectLabel}
            options={languageOptions}
          />
          <DownloadButton label={downloadButtonLabel} />
        </div>
      </div>
    </header>
  );
}
