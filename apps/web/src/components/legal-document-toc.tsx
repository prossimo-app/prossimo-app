"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LegalDocumentTocItem = {
  id: string;
  title: string;
};

type LegalDocumentTocProps = {
  label: string;
  items: readonly LegalDocumentTocItem[];
};

export function LegalDocumentToc({ items, label }: LegalDocumentTocProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    let animationFrame = 0;

    function updateActiveSection() {
      const offset = 120;
      const activeSection =
        items
          .map((item) => document.getElementById(item.id))
          .filter((section): section is HTMLElement => section !== null)
          .filter(
            (section) => section.getBoundingClientRect().top - offset <= 0,
          )
          .at(-1) ?? document.getElementById(items[0]?.id ?? "");

      if (activeSection) {
        setActiveId(activeSection.id);
      }
    }

    function handleScroll() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateActiveSection);
    }

    updateActiveSection();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [items]);

  return (
    <aside className="sticky top-24 hidden self-start lg:block">
      <nav aria-label={label} className="border-border border-l pl-5">
        <h2 className="mb-4 text-sm font-medium">{label}</h2>
        <ol className="space-y-2">
          {items.map((item) => {
            const isActive = activeId === item.id;

            return (
              <li key={item.id}>
                <Link
                  href={`#${item.id}`}
                  aria-current={isActive ? "location" : undefined}
                  className={`block text-sm leading-5 transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.title.replace(/^\d+\.\s/, "")}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
