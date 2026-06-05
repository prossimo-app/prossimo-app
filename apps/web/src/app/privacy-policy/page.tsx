import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";

import { createTranslator } from "@prossimo-app/localization/server";

import type { PrivacyPolicySection as PrivacyPolicySectionContent } from "./content";
import { Footer } from "~/components/footer";
import { LegalDocumentToc } from "~/components/legal-document-toc";
import { Navbar } from "~/components/navbar";
import { languageCookieName } from "~/utils/language-cookie";
import { resolveRequestLanguage } from "../request-language";
import { privacyPolicyContent } from "./content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Prossimo collects, uses, and protects information when you use the app and website.",
  alternates: {
    canonical: "/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy | Prossimo",
    description:
      "Learn how Prossimo collects, uses, and protects information when you use the app and website.",
    url: "/privacy-policy",
  },
};

export default async function PrivacyPolicyPage() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const language = resolveRequestLanguage(
    requestHeaders.get("accept-language"),
    requestCookies.get(languageCookieName)?.value ?? null,
  );
  const t = createTranslator(language);
  const policy = privacyPolicyContent[language];

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
                  {policy.title}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {policy.effectiveDateLabel}: {policy.effectiveDate}
                </p>
                <p className="text-muted-foreground leading-7">
                  {policy.intro.beforeAppName}{" "}
                  <strong className="text-foreground font-medium">
                    {policy.intro.appName}
                  </strong>{" "}
                  {policy.intro.beforeWebsite}{" "}
                  <Link
                    href={policy.intro.websiteUrl}
                    className="text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
                  >
                    {policy.intro.websiteUrl}
                  </Link>
                  .
                </p>
              </header>

              <section className="space-y-4">
                <h2 className="font-medium">{policy.operator.heading}</h2>
                <div className="text-muted-foreground space-y-3 leading-7">
                  <p>
                    {policy.operator.contactEmailLabel}{" "}
                    <Link
                      href="mailto:contatto@prossimo.app"
                      className="text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
                    >
                      contatto@prossimo.app
                    </Link>
                  </p>
                  <p>{policy.operator.compliance}</p>
                </div>
              </section>

              {policy.sections.map((section) => (
                <PolicySection key={section.id} section={section} />
              ))}
            </article>

            <LegalDocumentToc
              items={policy.sections}
              label={policy.contentsLabel}
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

function PolicySection({ section }: { section: PrivacyPolicySectionContent }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="font-medium">{section.title}</h2>
      <div className="text-muted-foreground mt-4 space-y-3 leading-7">
        {"paragraphs" in section &&
          section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}

        {"bullets" in section && section.bullets ? (
          <PolicyList items={section.bullets} />
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
                  <PolicyList items={group.bullets} />
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

        {section.id === "your-rights" ? <ContactLink /> : null}
        {section.id === "contact" ? <ContactLink /> : null}
      </div>
    </section>
  );
}

function PolicyList({ items }: { items: readonly string[] }) {
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
    <p>
      <Link
        href="mailto:contatto@prossimo.app"
        className="text-foreground hover:text-muted-foreground underline underline-offset-4 transition-colors"
      >
        contatto@prossimo.app
      </Link>
    </p>
  );
}
