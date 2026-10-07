/**
 * Geo-spatial utilities for location-based search and distance filtering.
 *
 * Provides accurate great-circle calculations via the Haversine formula,
 * bounding-box pre-filtering for fast SQL indexed queries, and unit conversions.
 */

const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Calculates great-circle distance between two points in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    throw new Error(`invalid coordinates: (${lat1}, ${lon1}), (${lat2}, ${lon2})`);
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const rLat1 = toRadians(lat1);
  const rLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_KM * c * 100) / 100;
}

/**
 * Calculates great-circle distance in miles.
 */
export function haversineDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const km = haversineDistanceKm(lat1, lon1, lat2, lon2);
  return Math.round(km * KM_TO_MILES * 100) / 100;
}

/**
 * Computes a bounding box (lat/lon rectangle) around a central point
 * for efficient coarse filtering in SQL before calculating exact distances.
 */
export function calculateBoundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
): BoundingBox {
  if (!isValidCoordinate(latitude, longitude)) {
    throw new Error(`invalid center coordinate: (${latitude}, ${longitude})`);
  }
  if (radiusKm <= 0) {
    throw new Error(`radius must be positive: ${radiusKm}`);
  }

  const radDist = radiusKm / EARTH_RADIUS_KM;
  const radLat = toRadians(latitude);
  const radLon = toRadians(longitude);

  const minLat = radLat - radDist;
  const maxLat = radLat + radDist;

  // Compute longitude delta accounting for latitude convergence
  const deltaLon = Math.asin(Math.sin(radDist) / Math.cos(radLat));
  const minLon = radLon - deltaLon;
  const maxLon = radLon + deltaLon;

  return {
    minLatitude: Math.max(-90, toDegrees(minLat)),
    maxLatitude: Math.min(90, toDegrees(maxLat)),
    minLongitude: Math.max(-180, toDegrees(minLon)),
    maxLongitude: Math.min(180, toDegrees(maxLon)),
  };
}
