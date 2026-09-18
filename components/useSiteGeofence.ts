"use client";

import { geofenceCheck } from "@/lib/geofence";
import type { JobSite } from "@/lib/time";
import { useCallback, useEffect, useState } from "react";

export type GeoState =
  | { status: "pending" }
  | { status: "unsupported"; message: string }
  | { status: "denied"; message: string }
  | { status: "error"; message: string }
  | {
      status: "ready";
      lat: number;
      lng: number;
      accuracy_m: number | null;
      distance_m: number;
      inside: boolean;
    };

export const LOCATION_ENABLE_HINT =
  "Location is required to punch in. iPhone: Settings → Privacy & Security → Location Services → Safari or Chrome → While Using. Desktop: address-bar lock icon → Location → Allow, then Retry. Punch-in stays locked without GPS.";

export function useSiteGeofence(site: JobSite) {
  const [geo, setGeo] = useState<GeoState>({ status: "pending" });
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => {
    setGeo({ status: "pending" });
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    function fail(next: GeoState) {
      window.setTimeout(() => {
        if (!cancelled) setGeo(next);
      }, 0);
    }

    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      fail({
        status: "unsupported",
        message: "This browser has no GPS. Use a phone or job iPad on site.",
      });
      return () => {
        cancelled = true;
      };
    }
    if (!window.isSecureContext) {
      fail({
        status: "error",
        message: "Location only works on https or localhost.",
      });
      return () => {
        cancelled = true;
      };
    }

    function onPos(pos: GeolocationPosition) {
      if (cancelled) return;
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const check = geofenceCheck({ lat, lng }, site);
      setGeo({
        status: "ready",
        lat,
        lng,
        accuracy_m: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        distance_m: check.distance_m,
        inside: check.ok,
      });
    }

    function onErr(err: GeolocationPositionError) {
      if (cancelled) return;
      if (err.code === err.PERMISSION_DENIED) {
        setGeo({ status: "denied", message: LOCATION_ENABLE_HINT });
        return;
      }
      setGeo({
        status: "error",
        message:
          err.code === err.TIMEOUT
            ? "GPS timed out. Stand near a window and tap Retry."
            : "Could not read GPS. Tap Retry.",
      });
    }

    const watchId = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      timeout: 12_000,
      maximumAge: 8_000,
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [site.lat, site.lng, site.radius_m, nonce, site]);

  return { geo, retry };
}
