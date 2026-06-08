import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";

import { createTranslator } from "@prossimo-app/localization/server";

import { Footer } from "~/components/footer";
import { Navbar } from "~/components/navbar";
import { languageCookieName } from "~/utils/language-cookie";
import { resolveRequestLanguage } from "../request-language";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Prossimo team for support, questions, or feedback.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | Prossimo",
    description:
      "Contact the Prossimo team for support, questions, or feedback.",
    url: "/contact",
  },
};

export default async function ContactPage() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const language = resolveRequestLanguage(
    requestHeaders.get("accept-language"),
    requestCookies.get(languageCookieName)?.value ?? null,
  );
  const t = createTranslator(language);

  return (
    <>
      <Navbar
        downloadButtonLabel={t("web.downloadButton")}
        language={language}
        languageSelectLabel={t("settings.language.accessibilityLabel")}
      />

      <main className="bg-background flex min-h-screen flex-col justify-between">
        <section className="mx-auto flex w-11/12 flex-col items-center justify-center pt-32 pb-16 lg:w-2/3">
          <div className="space-y-6">
            <header className="space-y-4">
              <h1 className="text-foreground font-serif text-2xl">
                {t("web.contact.title")}
              </h1>
              <p className="text-muted-foreground lg:w-2/3">
                {t("web.contact.description")}
              </p>
              <Link
                href="mailto:contatto@prossimo.app"
                className="text-foreground hover:text-muted-foreground decoration-muted-foreground hover:decoration-muted-foreground font-medium underline underline-offset-4"
              >
                contatto@prossimo.app
              </Link>
            </header>
          </div>
        </section>

        <Footer
          linksLabel={t("web.footer.links")}
          legalLabel={t("settings.sections.legal")}
          privacyPolicyLabel={t("settings.legal.privacyPolicy")}
          termsOfUseLabel={t("settings.legal.termsOfUse")}
          contactLabel={t("settings.legal.contact")}
          navigationLinks={[
            {
              href: "/#features",
              label: t("web.footer.features"),
            },
            {
              href: "/#faq",
              label: t("web.footer.faq"),
            },
            {
              href: "/#download",
              label: t("web.footer.download"),
            },
          ]}
        />
      </main>
    </>
  );
}
