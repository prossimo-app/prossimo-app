"use client";

import { useRouter } from "next/navigation";
import { Select } from "@base-ui/react/select";

import type { SupportedLanguage } from "@prossimo-app/localization";

import { languageCookieName } from "~/utils/language-cookie";

interface LanguageSelectOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

interface LanguageSelectProps {
  currentLanguage: SupportedLanguage;
  label: string;
  options: readonly LanguageSelectOption[];
}

export function LanguageSelect({
  currentLanguage,
  label,
  options,
}: LanguageSelectProps) {
  const router = useRouter();
  const selectItems = options.map((option) => ({
    label: option.nativeLabel,
    value: option.code,
  }));

  return (
    <Select.Root
      items={selectItems}
      value={currentLanguage}
      onValueChange={(value) => {
        if (value === null) {
          return;
        }

        document.cookie = `${languageCookieName}=${value}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      <Select.Trigger
        aria-label={label}
        className="border-border bg-background text-foreground focus-visible:ring-ring hover:border-ring/40 data-popup-open:border-ring/50 inline-flex h-9 min-w-24 cursor-pointer items-center justify-between gap-2 rounded-2xl border px-3 text-sm font-medium shadow-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Select.Value className="truncate" />
        <Select.Icon className="text-muted-foreground transition-transform duration-200 data-popup-open:rotate-180">
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={8} alignItemWithTrigger={false}>
          <Select.Popup className="border-border bg-background text-foreground z-50 min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-xl border p-1 shadow-lg transition-[transform,opacity] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.code}
                  value={option.code}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground grid cursor-pointer grid-cols-[1rem_minmax(0,1fr)] items-center gap-2 rounded-2xl px-2.5 py-2 text-sm transition-colors outline-none select-none"
                >
                  <Select.ItemIndicator className="text-primary col-start-1">
                    <CheckIcon />
                  </Select.ItemIndicator>
                  <Select.ItemText className="col-start-2 truncate">
                    {option.nativeLabel}
                  </Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="block h-4 w-4"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m4 6 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="block h-4 w-4"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m3.25 8.25 3 3 6.5-6.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
