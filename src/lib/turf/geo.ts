export type LatLng = { lat: number; lng: number };

/** Sayaji Garden — used when the player declines GPS. */
export const VADODARA_CENTRE: LatLng = { lat: 22.310696, lng: 73.192635 };

export const AREA_PINS: { id: string; label: string; lat: number; lng: number }[] = [
  { id: "centre", label: "City centre", lat: 22.310696, lng: 73.192635 },
  { id: "alkapuri", label: "Alkapuri", lat: 22.3132, lng: 73.1718 },
  { id: "ankodiya", label: "Ankodiya", lat: 22.3359, lng: 73.1217 },
  { id: "gotri", label: "Gotri", lat: 22.3218, lng: 73.1465 },
  { id: "sevasi", label: "Sevasi", lat: 22.3155, lng: 73.118 },
  { id: "bhayli", label: "Bhayli", lat: 22.2955, lng: 73.1285 },
  { id: "atladara", label: "Atladara", lat: 22.2735, lng: 73.156 },
  { id: "harni", label: "Harni", lat: 22.3365, lng: 73.2135 },
  { id: "karelibaug", label: "Karelibaug", lat: 22.3188, lng: 73.1985 },
  { id: "sama", label: "Sama", lat: 22.355, lng: 73.195 },
  { id: "manjalpur", label: "Manjalpur", lat: 22.27052, lng: 73.18686 },
  { id: "makarpura", label: "Makarpura", lat: 22.247, lng: 73.1955 },
  { id: "tarsali", label: "Tarsali", lat: 22.2574, lng: 73.2212 },
  { id: "chhani", label: "Chhani", lat: 22.368, lng: 73.1705 },
  { id: "waghodia", label: "Waghodia", lat: 22.3085, lng: 73.363 },
];

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number) {
  if (km < 0.15) return "Here";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsDirUrl(address: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

export function telHref(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (!d) return null;
  const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  return `tel:+91${local}`;
}
