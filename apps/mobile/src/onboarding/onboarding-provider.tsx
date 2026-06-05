import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";

const onboardingStorageKey = "hasSeenOnboarding";

interface OnboardingContextValue {
  completeOnboarding: () => Promise<void>;
  hasLoadedOnboardingState: boolean;
  hasSeenOnboarding: boolean;
  resetOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [hasLoadedOnboardingState, setHasLoadedOnboardingState] =
    useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboardingState() {
      try {
        const value = await SecureStore.getItemAsync(onboardingStorageKey);

        if (isMounted) {
          setHasSeenOnboarding(value === "true");
        }
      } finally {
        if (isMounted) {
          setHasLoadedOnboardingState(true);
        }
      }
    }

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, []);

  const completeOnboarding = useCallback(async () => {
    await SecureStore.setItemAsync(onboardingStorageKey, "true");
    setHasSeenOnboarding(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await SecureStore.deleteItemAsync(onboardingStorageKey);
    setHasSeenOnboarding(false);
  }, []);

  const value = useMemo(
    () => ({
      completeOnboarding,
      hasLoadedOnboardingState,
      hasSeenOnboarding,
      resetOnboarding,
    }),
    [
      completeOnboarding,
      hasLoadedOnboardingState,
      hasSeenOnboarding,
      resetOnboarding,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);

  if (context === null) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }

  return context;
}
