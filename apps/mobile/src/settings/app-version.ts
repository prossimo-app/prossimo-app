import Constants from "expo-constants";

export function getAppVersion() {
  const expoConfigVersion = (
    Constants.expoConfig as { version?: unknown } | null
  )?.version;
  const nativeApplicationVersion =
    Constants.nativeApplicationVersion as unknown;

  if (typeof expoConfigVersion === "string") {
    return expoConfigVersion;
  }

  if (typeof nativeApplicationVersion === "string") {
    return nativeApplicationVersion;
  }

  return "";
}
