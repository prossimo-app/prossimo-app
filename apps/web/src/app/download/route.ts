import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const androidStoreUrl =
  process.env.GOOGLE_PLAY_DOWNLOAD_URL ??
  "https://play.google.com/store/apps/details?id=com.prossimo.app";
const iosStoreUrl =
  process.env.APP_STORE_DOWNLOAD_URL ??
  "https://apps.apple.com/us/app/prossimo/id6777119422";

export function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const landingUrl = new URL("/", request.url);
  const downloadUrl = getDownloadUrl(userAgent);

  return NextResponse.redirect(downloadUrl ?? landingUrl);
}

function getDownloadUrl(userAgent: string) {
  if (isAndroid(userAgent)) {
    return toStoreUrl(androidStoreUrl);
  }

  if (isIos(userAgent)) {
    return toStoreUrl(iosStoreUrl);
  }

  return null;
}

function isAndroid(userAgent: string) {
  return /Android/i.test(userAgent);
}

function isIos(userAgent: string) {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
  );
}

function toStoreUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
      return parsedUrl;
    }
  } catch {
    return null;
  }

  return null;
}
