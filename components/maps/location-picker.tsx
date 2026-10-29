"use client";

import { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  LocateFixed,
  MapPin,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { MapView, type MapMarker } from "./map-view";
import { Badge } from "@/components/reui/badge";
import { FieldError } from "@/components/ui";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface LocationValue {
  latitude: number;
  longitude: number;
  address: string;
  radiusMeters: number;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  error?: string;
  showRadius?: boolean;
}

export function LocationPicker({
  value,
  onChange,
  error,
  showRadius = true,
}: LocationPickerProps) {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const reverseRequest = useRef(0);
  const latestValue = useRef(value);

  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  const markers: MapMarker[] = [
    {
      id: "site",
      latitude: value.latitude,
      longitude: value.longitude,
      label: value.address || "Titik absen",
      type: "selected",
    },
  ];

  function updateCoordinates(latitude: number, longitude: number) {
    onChange({
      ...value,
      latitude,
      longitude,
      address: "",
    });
    void reverseGeocode(latitude, longitude);
  }

  async function reverseGeocode(latitude: number, longitude: number) {
    const requestId = reverseRequest.current + 1;
    reverseRequest.current = requestId;
    setReverseLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=id`,
        {
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { display_name?: string };
      if (reverseRequest.current !== requestId) return;
      if (data.display_name) {
        onChange({
          ...latestValue.current,
          latitude,
          longitude,
          address: data.display_name,
        });
      }
    } catch {
      // Coordinates remain usable when reverse geocoding is unavailable.
    } finally {
      if (reverseRequest.current === requestId) setReverseLoading(false);
    }
  }

  async function searchLocation(event?: React.FormEvent) {
    event?.preventDefault();
    if (!search.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(search)}&countrycodes=id&limit=1&accept-language=id`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Pencarian gagal.");
      const data = (await response.json()) as Array<{
        lat: string;
        lon: string;
        display_name: string;
      }>;
      if (!data.length) {
        toast.error("Lokasi tidak ditemukan. Coba kata kunci lain.");
        return;
      }
      const result = data[0];
      onChange({
        ...value,
        latitude: Number(result.lat),
        longitude: Number(result.lon),
        address: result.display_name,
      });
      toast.success("Lokasi ditemukan.");
    } catch {
      toast.error(
        "Pencarian lokasi tidak tersedia. Klik peta atau gunakan lokasi saat ini.",
      );
    } finally {
      setSearching(false);
    }
  }

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Browser ini tidak mendukung lokasi GPS.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          ...value,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: "",
        });
        void reverseGeocode(
          position.coords.latitude,
          position.coords.longitude,
        );
        setLocating(false);
        toast.success("Titik lokasi menggunakan posisi saat ini.");
      },
      () => {
        setLocating(false);
        toast.error(
          "Lokasi tidak dapat diambil. Periksa izin lokasi browser.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchLocation();
              }
            }}
            placeholder="Cari gedung, jalan, atau area…"
            aria-label="Cari lokasi"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="xs"
              onClick={() => void searchLocation()}
              disabled={searching}
            >
              {searching ? <Spinner className="size-3.5" /> : <Search />}
              Cari
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="button"
          variant="outline"
          onClick={useCurrentLocation}
          disabled={locating}
          className="shrink-0"
        >
          {locating ? <Spinner /> : <LocateFixed className="text-primary" />}
          Lokasi saya
        </Button>
      </div>

      <div
        className={cn(
          "relative isolate h-[270px] overflow-hidden rounded-lg border border-border sm:h-[320px]",
          error && "border-destructive/60",
        )}
      >
        <MapView
          center={{
            latitude: value.latitude,
            longitude: value.longitude,
          }}
          markers={markers}
          radiusMeters={showRadius ? value.radiusMeters : undefined}
          zoom={16}
          interactive
          onMapClick={(coordinate) =>
            updateCoordinates(coordinate.latitude, coordinate.longitude)
          }
          className="size-full cursor-crosshair"
        />
        <Badge
          variant="outline"
          className="pointer-events-none absolute left-3 top-3 z-400 bg-background/95 backdrop-blur"
        >
          <Crosshair className="text-primary" />
          Klik peta untuk memindahkan titik
        </Badge>
        {reverseLoading && (
          <Badge
            variant="outline"
            className="absolute bottom-3 left-3 z-400 bg-background/95 backdrop-blur"
          >
            <Spinner className="size-3" />
            Mencari alamat…
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address">Alamat / patokan lokasi</Label>
          <InputGroup>
            <InputGroupAddon>
              <MapPin />
            </InputGroupAddon>
            <InputGroupInput
              id="address"
              value={value.address}
              onChange={(event) =>
                onChange({ ...value, address: event.target.value })
              }
              aria-invalid={Boolean(error)}
              placeholder="Contoh: Menara Sentraya, lobi utama"
            />
          </InputGroup>
        </div>
        {showRadius && (
          <div className="flex flex-col gap-1.5 sm:w-36">
            <Label htmlFor="radius">Radius absen</Label>
            <InputGroup>
              <InputGroupInput
                id="radius"
                type="number"
                min={25}
                max={1000}
                step={5}
                value={value.radiusMeters}
                onChange={(event) =>
                  onChange({
                    ...value,
                    radiusMeters: Math.max(
                      25,
                      Math.min(1000, Number(event.target.value) || 25),
                    ),
                  })
                }
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="text-xs font-medium">m</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </div>
        )}
      </div>

      {showRadius && (
        <div className="flex flex-col gap-1.5">
          <input
            type="range"
            min={25}
            max={1_000}
            step={5}
            value={Math.min(1_000, value.radiusMeters)}
            onChange={(event) =>
              onChange({ ...value, radiusMeters: Number(event.target.value) })
            }
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label="Atur radius absen"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>25 m</span>
            <span className="text-primary">
              Lingkaran radius terlihat di peta
            </span>
            <span>1.000 m</span>
          </div>
        </div>
      )}

      <FieldError>{error}</FieldError>
    </div>
  );
}
