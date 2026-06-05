import Link from "next/link";

import { BrandIcon } from "./brand-icon";

type FooterLink = {
  href: string;
  label: string;
};

type FooterProps = {
  legalLabel: string;
  linksLabel: string;
  navigationLinks: FooterLink[];
  privacyPolicyLabel: string;
  termsOfUseLabel: string;
};

const APP_NAME = "Prossimo";

export function Footer({
  legalLabel,
  linksLabel,
  navigationLinks,
  privacyPolicyLabel,
  termsOfUseLabel,
}: FooterProps) {
  return (
    <footer className="mx-auto w-11/12 pb-8 lg:w-2/3">
      <div className="border-border flex flex-col gap-8 border-t py-8 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Link href="/" className="flex items-center gap-2 select-none">
            <BrandIcon alt={APP_NAME} />
            <span className="text-lg font-medium">{APP_NAME}</span>
          </Link>
          <p className="text-muted-foreground text-sm">
            &copy; {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:min-w-80">
          <FooterLinkGroup label={linksLabel} links={navigationLinks} />
          <FooterLinkGroup
            label={legalLabel}
            links={[
              {
                href: "/privacy-policy",
                label: privacyPolicyLabel,
              },
              {
                href: "/terms",
                label: termsOfUseLabel,
              },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterLinkGroup({
  label,
  links,
}: {
  label: string;
  links: FooterLink[];
}) {
  return (
    <nav aria-label={label} className="space-y-3">
      <h2 className="text-sm font-medium">{label}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
