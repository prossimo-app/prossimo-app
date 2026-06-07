"use client";

import type { ReactNode } from "react";
import { ConsentManagerProvider } from "@c15t/nextjs";

export default function ConsentManagerClient({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConsentManagerProvider
      options={{
        mode: "offline",
        consentCategories: ["necessary", "measurement", "marketing"],
      }}
    >
      {children}
    </ConsentManagerProvider>
  );
}
