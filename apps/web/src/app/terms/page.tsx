import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";

import { createTranslator } from "@prossimo-app/localization/server";

import type { TermsSection as TermsSectionContent } from "./content";
import { Footer } from "~/components/footer";
import { LegalDocumentToc } from "~/components/legal-document-toc";
import { Navbar } from "~/components/navbar";
import { languageCookieName } from "~/utils/language-cookie";
import { resolveRequestLanguage } from "../request-language";
import { termsContent } from "./content";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Read the terms that govern your use of Prossimo and the Prossimo website.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Use | Prossimo",
    description:
      "Read the terms that govern your use of Prossimo and the Prossimo website.",
    url: "/terms",
  },
};

export default async function TermsPage() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const language = resolveRequestLanguage(
    requestHeaders.get("accept-language"),
    requestCookies.get(languageCookieName)?.value ?? null,
  );
  const t = createTranslator(language);
  const terms = termsContent[language];

  return (
    <>
      <Navbar
        downloadButtonLabel={t("web.downloadButton")}
        language={language}
        languageSelectLabel={t("settings.language.accessibilityLabel")}
      />

      <main className="bg-background min-h-screen">
        <section className="mx-auto w-11/12 pt-28 pb-16 lg:w-2/3 lg:pt-32 lg:pb-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <article className="max-w-3xl space-y-10">
              <header className="space-y-4">
                <h1 className="font-serif text-xl lg:text-2xl">
                  {terms.title}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {terms.effectiveDateLabel}: {terms.effectiveDate}
                </p>
                <p className="text-muted-foreground leading-7">
                  {terms.intro.beforeAppName}{" "}
                  <strong className="text-foreground font-medium">
                    {terms.intro.appName}
                  </strong>{" "}
                  {terms.intro.beforeWebsite}{" "}
                  <Link
                    href={terms.intro.websiteUrl}
                    className="text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
                  >
                    {terms.intro.websiteUrl}
                  </Link>
                  .
                </p>
                <p className="text-muted-foreground leading-7">
                  {terms.contactEmailLabel} <ContactLink />
                </p>
                <p className="text-muted-foreground leading-7">
                  {terms.agreement}
                </p>
              </header>

              {terms.sections.map((section) => (
                <TermsSection key={section.id} section={section} />
              ))}
            </article>

            <LegalDocumentToc
              items={terms.sections}
              label={terms.contentsLabel}
            />
          </div>
        </section>
      </main>

      <Footer
        linksLabel={t("web.footer.links")}
        legalLabel={t("settings.sections.legal")}
        privacyPolicyLabel={t("settings.legal.privacyPolicy")}
        termsOfUseLabel={t("settings.legal.termsOfUse")}
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
    </>
  );
}

function TermsSection({ section }: { section: TermsSectionContent }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="font-medium">{section.title}</h2>
      <div className="text-muted-foreground mt-4 space-y-3 leading-7">
        {"paragraphs" in section &&
          section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

        {"bullets" in section && section.bullets ? (
          <TermsList items={section.bullets} />
        ) : null}

        {"groups" in section && section.groups ? (
          <div className="space-y-6">
            {section.groups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="text-foreground font-medium">{group.title}</h3>
                {group.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {"bullets" in group && group.bullets ? (
                  <TermsList items={group.bullets} />
                ) : null}
                {"after" in group && group.after
                  ? group.after.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))
                  : null}
              </div>
            ))}
          </div>
        ) : null}

        {"after" in section && section.after
          ? section.after.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
          : null}

        {section.id === "contact" ? (
          <p>
            <ContactLink />
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TermsList({ items }: { items: readonly string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ContactLink() {
  return (
    <Link
      href="mailto:contatto@prossimo.app"
      className="text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
    >
      contatto@prossimo.app
    </Link>
  );
}
