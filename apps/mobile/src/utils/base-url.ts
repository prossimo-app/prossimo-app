import Constants from "expo-constants";

const PRODUCTION_API_URL = "https://api.prossimo.app";
const PRODUCTION_WS_URL = "wss://api.prossimo.app";
const DEV_API_PORT = 3000;
const DEV_WS_PORT = 1337;

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

function getHostFromUrl(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function getDevServerUrlFromLinkingUri() {
  const linkingUri = Constants.linkingUri;

  if (!linkingUri) {
    return undefined;
  }

  try {
    const url = new URL(linkingUri);
    const devServerUrl = url.searchParams.get("url");

    return devServerUrl ?? undefined;
  } catch {
    return undefined;
  }
}

function getDevServerHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    getDevServerUrlFromLinkingUri();

  if (!hostUri) {
    return undefined;
  }

  return getHostFromUrl(
    hostUri.includes("://") ? hostUri : `http://${hostUri}`,
  );
}

function isLoopbackHost(host: string) {
  const normalizedHost = host.replace(/^\[(.*)\]$/, "$1");

  return (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  );
}

function formatHostForUrl(host: string) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function getReachableDevUrl(
  configuredUrl: string,
  devServerHost: string | undefined,
) {
  const trimmedUrl = trimTrailingSlash(configuredUrl);

  if (!devServerHost) {
    return trimmedUrl;
  }

  try {
    const url = new URL(trimmedUrl);

    if (isLoopbackHost(url.hostname)) {
      const port = url.port ? `:${url.port}` : "";

      return trimTrailingSlash(
        `${url.protocol}//${formatHostForUrl(devServerHost)}${port}${url.pathname}${url.search}${url.hash}`,
      );
    }

    return trimTrailingSlash(url.toString());
  } catch {
    return trimmedUrl;
  }
}

export function getBaseUrl() {
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  const host = getDevServerHost();

  if (configuredUrl) {
    return getReachableDevUrl(configuredUrl, host);
  }

  if (!host) {
    return PRODUCTION_API_URL;
  }

  return `http://${host}:${DEV_API_PORT}`;
}

export function getWebSocketBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_WS_URL;
  const host = getDevServerHost();

  if (configuredUrl) {
    return __DEV__
      ? getReachableDevUrl(configuredUrl, host)
      : trimTrailingSlash(configuredUrl);
  }

  if (!__DEV__) {
    return PRODUCTION_WS_URL;
  }

  if (!host) {
    return PRODUCTION_WS_URL;
  }

  return `ws://${host}:${DEV_WS_PORT}`;
}
