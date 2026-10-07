import {
  calculateBoundingBox,
  haversineDistanceKm,
  haversineDistanceMiles,
  isValidCoordinate,
} from './geo';

describe('geo-spatial utilities', () => {
  it('validates coordinate boundaries', () => {
    expect(isValidCoordinate(40.7128, -74.006)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);

    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(0, -181)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
  });

  it('calculates zero distance for identical coordinates', () => {
    expect(haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
    expect(haversineDistanceMiles(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('calculates accurate distance between known city pairs', () => {
    // London to Paris is ~343-345 km
    const distKm = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distKm).toBeGreaterThan(340);
    expect(distKm).toBeLessThan(350);

    const distMiles = haversineDistanceMiles(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distMiles).toBeGreaterThan(210);
    expect(distMiles).toBeLessThan(220);
  });

  it('computes bounding box containing points within radius', () => {
    const lat = 40.7128;
    const lon = -74.006;
    const box = calculateBoundingBox(lat, lon, 10); // 10 km radius

    expect(box.minLatitude).toBeLessThan(lat);
    expect(box.maxLatitude).toBeGreaterThan(lat);
    expect(box.minLongitude).toBeLessThan(lon);
    expect(box.maxLongitude).toBeGreaterThan(lon);

    // Any point right on the radius edge must fall inside or at box bounds
    const northEdgeLat = lat + (10 / 6371) * (180 / Math.PI);
    expect(box.maxLatitude).toBeCloseTo(northEdgeLat, 2);
  });

  it('throws for invalid arguments', () => {
    expect(() => haversineDistanceKm(95, 0, 0, 0)).toThrow(/invalid coordinates/i);
    expect(() => calculateBoundingBox(0, 0, -5)).toThrow(/radius must be positive/i);
  });
});
