"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label?: string;
  showLabel?: boolean;
  type?: "site" | "worker" | "selected";
}

export interface LeafletMapInnerProps {
  center: { latitude: number; longitude: number };
  zoom?: number;
  radiusMeters?: number;
  markers?: MapMarker[];
  interactive?: boolean;
  zoomAnimation?: boolean;
  onMapClick?: (coordinate: { latitude: number; longitude: number }) => void;
  className?: string;
}

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export default function LeafletMapInner({
  center,
  zoom = 15,
  radiusMeters,
  markers = [],
  interactive = true,
  zoomAnimation = true,
  onMapClick,
  className,
}: LeafletMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  const fittedSignatureRef = useRef("");

  clickRef.current = onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.latitude, center.longitude],
      zoom,
      zoomControl: false,
      zoomAnimation,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: ATTRIBUTION,
    }).addTo(map);

    if (interactive) {
      L.control.zoom({ position: "bottomright" }).addTo(map);
    }

    const overlay = L.layerGroup().addTo(map);
    overlayRef.current = overlay;
    mapRef.current = map;

    map.on("click", (event: L.LeafletMouseEvent) => {
      if (!clickRef.current) return;
      clickRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    map.whenReady(() => {
      window.setTimeout(() => map.invalidateSize(), 80);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // Only initialize once; props are reflected in the update effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;

    overlay.clearLayers();

    if (radiusMeters && radiusMeters > 0) {
      L.circle([center.latitude, center.longitude], {
        radius: radiusMeters,
        color: "var(--primary)",
        weight: 1.5,
        opacity: 0.65,
        fillColor: "var(--primary)",
        fillOpacity: 0.1,
        dashArray: "4 4",
      }).addTo(overlay);
    }

    for (const marker of markers) {
      const icon = L.divIcon({
        className:
          marker.type === "worker"
            ? "worker-marker"
            : "site-marker",
        html:
          marker.type === "worker"
            ? '<div class="worker-marker-dot"></div>'
            : `<div class="site-marker-pin${marker.type === "selected" ? " site-marker-selected" : ""}"></div>`,
        iconSize: marker.type === "worker" ? [17, 17] : [22, 22],
        iconAnchor: marker.type === "worker" ? [8, 8] : [11, 22],
      });
      const instance = L.marker([marker.latitude, marker.longitude], {
        icon,
        interactive: Boolean(marker.label),
      }).addTo(overlay);
      if (marker.label) {
        // Leaflet treats string tooltip content as HTML. Use a DOM node with
        // textContent so persisted names/addresses cannot inject markup.
        const labelNode = document.createElement("span");
        labelNode.textContent = marker.label;
        instance.bindTooltip(labelNode, {
          permanent: marker.showLabel ?? false,
          direction:
            marker.showLabel && marker.type === "worker" ? "bottom" : "top",
          offset:
            marker.showLabel && marker.type === "worker" ? [0, 12] : [0, -16],
          className: "lembur-map-tooltip",
        });
      }
    }

    const signature = [
      center.latitude.toFixed(5),
      center.longitude.toFixed(5),
      radiusMeters ?? 0,
      markers
        .map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}`)
        .join("|"),
      zoom,
    ].join("/");

    if (signature !== fittedSignatureRef.current) {
      fittedSignatureRef.current = signature;
      if (markers.length > 1 || (markers.length === 1 && radiusMeters)) {
        const points = markers.map(
          (marker) => [marker.latitude, marker.longitude] as L.LatLngExpression,
        );
        if (radiusMeters) {
          points.push(
            L.latLng(center.latitude, center.longitude).toBounds(radiusMeters * 2)
              .getNorthWest(),
            L.latLng(center.latitude, center.longitude).toBounds(radiusMeters * 2)
              .getSouthEast(),
          );
        }
        map.fitBounds(L.latLngBounds(points), {
          padding: [44, 44],
          maxZoom: 16,
        });
      } else {
        map.setView([center.latitude, center.longitude], zoom, {
          animate: false,
        });
      }
    }
  }, [center.latitude, center.longitude, markers, radiusMeters, zoom]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label="Peta lokasi SPKL"
    />
  );
}
