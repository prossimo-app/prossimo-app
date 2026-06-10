import { getHashedInstallIdAsync } from "./install-id";

export type AnalyticsEventProperties = Record<
  string,
  string | number | boolean | null
>;

export interface AnalyticsEvent {
  name: string;
  properties?: AnalyticsEventProperties;
  timestamp: number;
}

/**
 * Implement this interface to plug in a real analytics provider (PostHog,
 * Amplitude, ...). The client guarantees that `identify` is called with the
 * hashed install ID before any `track` call, and that no method is called
 * while analytics is disabled.
 */
export interface AnalyticsBackend {
  identify(hashedInstallId: string): void | Promise<void>;
  track(event: AnalyticsEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}

const maxQueuedEvents = 50;

class AnalyticsClient {
  private backend: AnalyticsBackend | null = null;
  private enabled = false;
  private identified = false;
  private queue: AnalyticsEvent[] = [];

  /** Register the analytics provider. Safe to call once at app startup. */
  setBackend(backend: AnalyticsBackend) {
    this.backend = backend;
    this.identified = false;

    if (this.enabled) {
      void this.startSession();
    }
  }

  /**
   * Toggle analytics. Events tracked while disabled (or before the consent
   * state is known) are queued and delivered once analytics is enabled, or
   * dropped if it gets disabled.
   */
  setEnabled(enabled: boolean) {
    if (this.enabled === enabled) {
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      void this.startSession();
    } else {
      this.queue = [];
      this.identified = false;
    }
  }

  track(name: string, properties?: AnalyticsEventProperties) {
    const event: AnalyticsEvent = { name, properties, timestamp: Date.now() };

    if (!this.enabled || !this.identified || this.backend === null) {
      if (this.queue.length < maxQueuedEvents) {
        this.queue.push(event);
      }

      return;
    }

    void this.backend.track(event);
  }

  screen(name: string, properties?: AnalyticsEventProperties) {
    this.track("screen_viewed", { ...properties, screen: name });
  }

  async flush() {
    await this.backend?.flush?.();
  }

  private async startSession() {
    if (this.backend === null) {
      return;
    }

    const backend = this.backend;

    try {
      const hashedInstallId = await getHashedInstallIdAsync();

      // Consent may have been revoked while we were hashing.
      if (!this.enabled || this.backend !== backend) {
        return;
      }

      await backend.identify(hashedInstallId);
      this.identified = true;

      const queued = this.queue;

      this.queue = [];

      for (const event of queued) {
        void backend.track(event);
      }
    } catch {
      // Analytics must never break the app.
    }
  }
}

export const analytics = new AnalyticsClient();
