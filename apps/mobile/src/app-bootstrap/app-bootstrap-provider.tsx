import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
import { usePathname } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "~/utils/api";
import { useOnboarding } from "~/onboarding/onboarding-provider";
import { trpc } from "~/utils/api";

type AppBootstrap = RouterOutputs["app"]["getBootstrap"];

interface AppBootstrapContextValue {
  appBootstrap: AppBootstrap | null;
  appBootstrapError: unknown;
  hasLoadedAppBootstrap: boolean;
  isLoadingAppBootstrap: boolean;
  refetchAppBootstrap: () => Promise<AppBootstrap | null>;
}

const AppBootstrapContext = createContext<AppBootstrapContextValue | null>(
  null,
);

export function AppBootstrapProvider({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { hasLoadedOnboardingState, hasSeenOnboarding } = useOnboarding();
  const shouldLoadAppBootstrap =
    hasLoadedOnboardingState && hasSeenOnboarding && pathname === "/";
  const { data, error, isPending, refetch } = useQuery({
    ...trpc.app.getBootstrap.queryOptions(),
    enabled: shouldLoadAppBootstrap,
  });

  const value = useMemo<AppBootstrapContextValue>(
    () => ({
      appBootstrap: data ?? null,
      appBootstrapError: error,
      hasLoadedAppBootstrap: !shouldLoadAppBootstrap || !isPending,
      isLoadingAppBootstrap: shouldLoadAppBootstrap && isPending,
      refetchAppBootstrap: async () => {
        if (!shouldLoadAppBootstrap) {
          return data ?? null;
        }

        const result = await refetch();

        return result.data ?? null;
      },
    }),
    [data, error, isPending, refetch, shouldLoadAppBootstrap],
  );

  return (
    <AppBootstrapContext.Provider value={value}>
      {children}
    </AppBootstrapContext.Provider>
  );
}

export function useAppBootstrap() {
  const context = useContext(AppBootstrapContext);

  if (context === null) {
    throw new Error("useAppBootstrap must be used within AppBootstrapProvider");
  }

  return context;
}
