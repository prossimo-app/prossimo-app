import type { Coordinates } from "expo-maps";

export const torinoCenter = {
  latitude: 45.0703,
  longitude: 7.6869,
} satisfies Coordinates;

export const torinoBounds = {
  north: 45.4,
  south: 44.8,
  east: 8,
  west: 7.1,
};

export function isInsideTorino(coordinates: Coordinates) {
  if (
    coordinates.latitude === undefined ||
    coordinates.longitude === undefined
  ) {
    return false;
  }

  return (
    coordinates.latitude >= torinoBounds.south &&
    coordinates.latitude <= torinoBounds.north &&
    coordinates.longitude >= torinoBounds.west &&
    coordinates.longitude <= torinoBounds.east
  );
}

export function clampToTorino(coordinates: Coordinates): Coordinates {
  return {
    latitude: clamp(coordinates.latitude ?? torinoCenter.latitude, [
      torinoBounds.south,
      torinoBounds.north,
    ]),
    longitude: clamp(coordinates.longitude ?? torinoCenter.longitude, [
      torinoBounds.west,
      torinoBounds.east,
    ]),
  };
}

function clamp(value: number, [min, max]: [number, number]) {
  return Math.min(Math.max(value, min), max);
}
