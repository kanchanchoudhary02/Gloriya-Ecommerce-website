import mongoose from "mongoose";

/**
 * Uploaded product images/videos are stored in MongoDB (GridFS) instead of the
 * server disk. Hosting platforms such as Render wipe the disk on every deploy or
 * restart, which is why admin uploads used to disappear from the website.
 */
let bucket = null;
function getBucket() {
  if (!bucket) bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "media" });
  return bucket;
}

export const MIME_BY_EXT = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm"
};

export function saveMedia({ name, buffer, contentType }) {
  return new Promise((resolve, reject) => {
    const up = getBucket().openUploadStream(name, { contentType, metadata: { contentType } });
    up.on("error", reject);
    up.on("finish", () => resolve(name));
    up.end(buffer);
  });
}

export async function findMedia(name) {
  const files = await getBucket().find({ filename: name }).limit(1).toArray();
  return files[0] || null;
}

export function openMediaStream(name, range) {
  return getBucket().openDownloadStreamByName(name, range ? { start: range.start, end: range.end + 1 } : undefined);
}

export async function deleteMedia(name) {
  try {
    const file = await findMedia(name);
    if (file) await getBucket().delete(file._id);
  } catch { /* already gone */ }
}
