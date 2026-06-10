import PostHog from "posthog-react-native";

import type { AnalyticsBackend, AnalyticsEvent } from "./analytics";

const posthogHost = "https://eu.i.posthog.com";

/**
 * Product-analytics-only PostHog backend. Session replay stays disabled and
 * lifecycle autocapture is off so every event flows through the consent-gated
 * analytics client, identified solely by the hashed install ID.
 */
export class PostHogAnalyticsBackend implements AnalyticsBackend {
  private readonly client: PostHog;

  constructor(apiKey: string) {
    this.client = new PostHog(apiKey, {
      captureAppLifecycleEvents: false,
      enableSessionReplay: false,
      host: posthogHost,
    });
  }

  identify(hashedInstallId: string) {
    this.client.identify(hashedInstallId);
  }

  track(event: AnalyticsEvent) {
    this.client.capture(event.name, event.properties, {
      timestamp: new Date(event.timestamp),
    });
  }

  async flush() {
    await this.client.flush();
  }
}
