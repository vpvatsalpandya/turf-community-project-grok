import { MAX_PHOTOS } from "./live";

const TARGET = 100_000;
const HARD = 140_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

/** Compress a night-turf shot to a JPEG data URL the desk can store. */
export async function compressVenuePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Pick a photo (jpg or png)");
  const img = await loadImage(file);
  const max = 960;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process photo");
  ctx.drawImage(img, 0, 0, w, h);
  let q = 0.74;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > TARGET && q > 0.42) {
    q -= 0.08;
    out = canvas.toDataURL("image/jpeg", q);
  }
  if (out.length > HARD) throw new Error("Photo is too heavy. Try a tighter crop.");
  return out;
}

export function canAddPhoto(existing: string[]) {
  return existing.length < MAX_PHOTOS;
}
