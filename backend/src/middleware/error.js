export function errorHandler(err, _req, res, _next) {
  console.error(err);
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(400).json({ msg: "File too large. Max 50 MB" });
  res.status(err?.status || 500).json({ msg: err?.publicMessage || "Internal server error" });
}
