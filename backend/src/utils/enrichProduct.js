import path from "node:path";
import { UPLOAD_CATEGORY_BY_FILE, galleryFilesForGroup } from "../data/uploadCatalog.js";

function publicMediaUrl(value) {
  if (!value) return "";
  const raw = String(value).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `/${raw.replace(/^\/+/, "")}`;
}

function basenameFromUrl(value) {
  if (!value) return "";
  try {
    const raw = String(value).split("?")[0].split("#")[0];
    return path.basename(raw);
  } catch {
    return String(value).split("/").pop() || "";
  }
}

export function enrichProduct(product) {
  if (!product) return product;
  const p = { ...product };
  const existingMedia = Array.isArray(p.media) ? p.media.map(m => typeof m === "string" ? { url: m, type: /\.(mp4|webm)$/i.test(m) ? "video" : "image" } : m).filter(Boolean) : [];
  const urls = [p.image, ...existingMedia.map(m => m?.url)].filter(Boolean);
  const groups = [];
  for (const url of urls) {
    const group = UPLOAD_CATEGORY_BY_FILE.get(basenameFromUrl(url));
    if (group && !groups.includes(group)) groups.push(group);
  }
  if (groups.length) {
    const primaryGroup = groups[0];
    p.category = primaryGroup.category;
    const seen = new Set(existingMedia.map(m => basenameFromUrl(m?.url || "")));
    for (const file of galleryFilesForGroup(primaryGroup)) {
      const url = `/uploads/${file}`;
      if (!seen.has(file)) {
        existingMedia.push({ url: publicMediaUrl(url), type: "image" });
        seen.add(file);
      }
    }
    if (!p.image) p.image = publicMediaUrl(`/uploads/${primaryGroup.files[0]}`);
    else p.image = publicMediaUrl(p.image);
    p.media = existingMedia;
  }
  p.image = publicMediaUrl(p.image);
  p.media = existingMedia.map(m => ({ ...m, url: publicMediaUrl(m?.url) }));
  return p;
}

export function enrichProducts(products) {
  return (products || []).map(enrichProduct);
}
