/** Haversine geofence helpers. Distances in meters. */

const EARTH_RADIUS_M = 6_371_000;

export type LatLng = {
  lat: number;
  lng: number;
};

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(hav)));
}

export function geofenceCheck(
  point: LatLng,
  site: LatLng & { radius_m: number },
): { ok: boolean; distance_m: number } {
  const distance_m = distanceMeters(point, { lat: site.lat, lng: site.lng });
  return { ok: distance_m <= site.radius_m, distance_m };
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function isFiniteLatLng(value: {
  lat: unknown;
  lng: unknown;
}): value is LatLng {
  return (
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}
