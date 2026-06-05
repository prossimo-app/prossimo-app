import { cookies, headers } from "next/headers";

import { createTranslator } from "@prossimo-app/localization/server";

import { LandingPage } from "~/components/landing-page";
import { languageCookieName } from "~/utils/language-cookie";
import { resolveRequestLanguage } from "./request-language";

export default async function Home() {
  const requestHeaders = await headers();
  const requestCookies = await cookies();
  const language = resolveRequestLanguage(
    requestHeaders.get("accept-language"),
    requestCookies.get(languageCookieName)?.value ?? null,
  );
  const t = createTranslator(language);

  return <LandingPage language={language} t={t} />;
}
