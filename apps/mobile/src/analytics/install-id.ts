import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";

// The raw install ID lives in the app's document directory so it is deleted
// together with the app on uninstall (SecureStore/Keychain would survive a
// reinstall on iOS, which we don't want). The raw UUID never leaves this
// module — only its SHA-256 hash is exposed to analytics code.
const installIdFile = new File(Paths.document, "analytics-install-id");

let hashedInstallIdPromise: Promise<string> | null = null;

function loadOrCreateRawInstallId(): string {
  if (installIdFile.exists) {
    const existingId = installIdFile.textSync().trim();

    if (existingId.length > 0) {
      return existingId;
    }
  }

  const newId = Crypto.randomUUID();

  installIdFile.write(newId);

  return newId;
}

/**
 * Returns the SHA-256 hash (lowercase hex) of this install's anonymous ID.
 * The ID is generated on first call after install and persisted on-device.
 * This hash is the only identifier that may be sent to analytics providers.
 */
export function getHashedInstallIdAsync(): Promise<string> {
  hashedInstallIdPromise ??= (async () => {
    let rawId: string;

    try {
      rawId = loadOrCreateRawInstallId();
    } catch {
      // If the filesystem is unavailable, fall back to an ephemeral ID for
      // this session rather than breaking the app.
      rawId = Crypto.randomUUID();
    }

    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawId);
  })();

  return hashedInstallIdPromise;
}
