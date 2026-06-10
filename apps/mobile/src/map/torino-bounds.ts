import type { Coordinates } from "expo-maps";

export const torinoCenter = {
  latitude: 45.0703,
  longitude: 7.6869,
} satisfies Coordinates;

// Generous box around the GTT service area (metro Turin plus the extra-urban
// network out to Susa, Pinerolo, and Ivrea). The realtime feed occasionally
// reports garbage positions like (0, 0); anything outside this box is feed
// noise, not a vehicle we can follow.
const serviceAreaBounds = {
  maxLatitude: 45.8,
  maxLongitude: 8.5,
  minLatitude: 44.4,
  minLongitude: 6.6,
};

export function isWithinTorinoServiceArea(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= serviceAreaBounds.minLatitude &&
    latitude <= serviceAreaBounds.maxLatitude &&
    longitude >= serviceAreaBounds.minLongitude &&
    longitude <= serviceAreaBounds.maxLongitude
  );
}
