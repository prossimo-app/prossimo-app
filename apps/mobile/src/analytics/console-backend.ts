import type { AnalyticsBackend, AnalyticsEvent } from "./analytics";

/**
 * Development backend that logs to the console. Replace with a real provider
 * backend (implementing `AnalyticsBackend`) when one is chosen.
 */
export class ConsoleAnalyticsBackend implements AnalyticsBackend {
  identify(hashedInstallId: string) {
    console.log(`[analytics] identify ${hashedInstallId}`);
  }

  track(event: AnalyticsEvent) {
    console.log(`[analytics] track ${event.name}`, event.properties ?? {});
  }
}
