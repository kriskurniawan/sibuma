"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeafletMapInnerProps } from "./leaflet-map-inner";

const Inner = dynamic(() => import("./leaflet-map-inner"), {
  ssr: false,
  loading: () => (
    <div
      className="relative flex size-full items-center justify-center bg-muted"
      role="status"
      aria-label="Memuat peta"
    >
      <Skeleton className="absolute inset-0 size-full" />
      <div className="relative flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MapPin className="size-4" aria-hidden="true" />
        Memuat peta…
      </div>
    </div>
  ),
});

export function MapView(props: LeafletMapInnerProps) {
  return <Inner {...props} />;
}

export type { MapMarker } from "./leaflet-map-inner";
