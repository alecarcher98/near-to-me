"use client";

import { Banknote, Beer, Car, Crosshair, Dumbbell, HeartPulse, MapPin, Minus, PlugZap, Plus, Salad, ShoppingBag, Shirt, Ticket, TrainFront, Utensils } from "lucide-react";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatDistance } from "@/lib/geo";
import { categoryColor } from "@/lib/places";
import type { LatLng } from "@/lib/types";
import type { NearbyPlace } from "@/lib/places";

// A small dependency-free street map: OpenStreetMap-style raster tiles in Web Mercator, with category pins on top.
// Set NEXT_PUBLIC_MAP_TILE_URL (with {z}/{x}/{y}) and NEXT_PUBLIC_MAP_ATTRIBUTION to use a tile provider with a key in production.
const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || "© OpenStreetMap contributors";
const tileSize = 256;
const minZoom = 11;
const maxZoom = 18;

export const categoryIcons: Record<string, typeof MapPin> = {
  Food: Utensils,
  "Healthy eats": Salad,
  Shopping: ShoppingBag,
  "Gyms & fitness": Dumbbell,
  "Attractions & days out": Ticket,
  "Pubs & bars": Beer,
  Parking: Car,
  "EV charging": PlugZap,
  Travel: TrainFront,
  "ATMs & Currency Exchange": Banknote,
  Laundry: Shirt,
  "A&E": HeartPulse,
};

export function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const Icon = categoryIcons[category] ?? MapPin;
  return <Icon size={size} strokeWidth={2.2} />;
}

function project({ lat, lng }: LatLng, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function unproject({ x, y }: { x: number; y: number }, zoom: number): LatLng {
  const scale = tileSize * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}

function metresPerPixel(lat: number, zoom: number) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

// The zoom that fits a circle of `radiusMiles` into the shorter side of the map.
function zoomForRadius(lat: number, radiusMiles: number, shortSide: number) {
  const wanted = (radiusMiles * 1609.34 * 2) / Math.max(shortSide * 0.9, 200);
  const zoom = Math.floor(Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / wanted));
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

type Props = {
  origin: LatLng;
  originLabel: string;
  radiusMiles: number;
  places: NearbyPlace[];
  selectedId?: string;
  onSelect: (place: NearbyPlace) => void;
};

export default function StreetMap({ origin, originLabel, radiusMiles, places, selectedId, onSelect }: Props) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 420 });
  const [zoom, setZoom] = useState(14);
  const [centre, setCentre] = useState<LatLng>(origin);
  const drag = useRef<{ x: number; y: number; centre: { x: number; y: number }; moved: boolean } | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Recentre and refit whenever the visitor's location or distance changes.
  useEffect(() => {
    setCentre(origin);
    setZoom(zoomForRadius(origin.lat, radiusMiles, Math.min(size.width, size.height)));
    // size is left out on purpose so resizing doesn't undo the visitor's own zooming.
  }, [origin.lat, origin.lng, radiusMiles]);

  // Pan to a place picked from the list if it's off screen.
  useEffect(() => {
    const place = places.find((item) => item.id === selectedId);
    if (!place) return;
    const point = project(place, zoom);
    const middle = project(centre, zoom);
    if (Math.abs(point.x - middle.x) > size.width / 2 - 30 || Math.abs(point.y - middle.y) > size.height / 2 - 30) setCentre({ lat: place.lat, lng: place.lng });
  }, [selectedId]);

  const middle = project(centre, zoom);
  const topLeft = { x: middle.x - size.width / 2, y: middle.y - size.height / 2 };

  const tiles = useMemo(() => {
    const count = 2 ** zoom;
    const list: { key: string; src: string; left: number; top: number }[] = [];
    for (let tx = Math.floor(topLeft.x / tileSize); tx <= Math.floor((topLeft.x + size.width) / tileSize); tx += 1) {
      for (let ty = Math.floor(topLeft.y / tileSize); ty <= Math.floor((topLeft.y + size.height) / tileSize); ty += 1) {
        if (ty < 0 || ty >= count) continue;
        const wrapped = ((tx % count) + count) % count;
        list.push({ key: `${zoom}/${tx}/${ty}`, src: tileUrl.replace("{z}", String(zoom)).replace("{x}", String(wrapped)).replace("{y}", String(ty)).replace("{s}", "abc"[(tx + ty) % 3]), left: tx * tileSize - topLeft.x, top: ty * tileSize - topLeft.y });
      }
    }
    return list;
  }, [zoom, topLeft.x, topLeft.y, size.width, size.height]);

  const toScreen = (point: LatLng) => {
    const projected = project(point, zoom);
    return { left: projected.x - topLeft.x, top: projected.y - topLeft.y };
  };
  const you = toScreen(origin);
  const radiusPixels = (radiusMiles * 1609.34) / metresPerPixel(origin.lat, zoom);

  function changeZoom(step: number) {
    setZoom((value) => Math.min(maxZoom, Math.max(minZoom, value + step)));
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, centre: middle, moved: false };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
    setCentre(unproject({ x: start.centre.x - dx, y: start.centre.y - dy }, zoom));
  }

  function onPointerUp() {
    drag.current = null;
  }

  // Draw the selected pin last so it sits on top.
  const visible = places
    .map((place) => ({ place, ...toScreen(place) }))
    .filter(({ left, top }) => left > -30 && top > -40 && left < size.width + 30 && top < size.height + 30)
    .sort((a, b) => Number(a.place.id === selectedId) - Number(b.place.id === selectedId) || a.top - b.top);

  return (
    <div
      className="street-map"
      ref={frame}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button, a")) changeZoom(1); }}
      role="region"
      aria-label={`Map of places within ${radiusMiles} miles of ${originLabel}`}
    >
      <div className="street-map-tiles" aria-hidden="true">
        {tiles.map((tile) => <img key={tile.key} src={tile.src} alt="" width={tileSize} height={tileSize} draggable={false} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin" style={{ left: tile.left, top: tile.top }} />)}
      </div>
      <span className="street-map-radius" style={{ left: you.left, top: you.top, width: radiusPixels * 2, height: radiusPixels * 2 }} aria-hidden="true" />
      {visible.map(({ place, left, top }) => {
        const selected = place.id === selectedId;
        return (
          <button
            key={place.id}
            type="button"
            className={selected ? "street-pin selected" : "street-pin"}
            style={{ left, top, ["--pin" as string]: categoryColor(place.category) }}
            onClick={() => onSelect(place)}
            title={`${place.name} · ${formatDistance(place.miles)}`}
            aria-label={`${place.name}, ${place.category}, ${formatDistance(place.miles)} away`}
          >
            <span className="street-pin-head"><CategoryIcon category={place.category} size={selected ? 16 : 13} /></span>
            {selected && <span className="street-pin-label">{place.name}</span>}
          </button>
        );
      })}
      <span className="street-map-you" style={{ left: you.left, top: you.top }} aria-hidden="true"><span /><b>{originLabel}</b></span>
      <div className="map-zoom street-map-zoom">
        <button type="button" onClick={() => changeZoom(1)} aria-label="Zoom in" disabled={zoom >= maxZoom}><Plus size={19} /></button>
        <button type="button" onClick={() => changeZoom(-1)} aria-label="Zoom out" disabled={zoom <= minZoom}><Minus size={19} /></button>
        <button type="button" onClick={() => { setCentre(origin); setZoom(zoomForRadius(origin.lat, radiusMiles, Math.min(size.width, size.height))); }} aria-label="Back to where you are"><Crosshair size={17} /></button>
      </div>
      <a className="street-map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{attribution}</a>
    </div>
  );
}
