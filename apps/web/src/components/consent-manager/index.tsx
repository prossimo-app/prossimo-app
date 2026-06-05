import type { ReactNode } from "react";

import ConsentManagerProvider from "./provider";

export function ConsentManager({ children }: { children: ReactNode }) {
  return <ConsentManagerProvider>{children}</ConsentManagerProvider>;
}
