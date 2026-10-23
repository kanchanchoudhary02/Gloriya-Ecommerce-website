import app from "./src/app.js";
import { env } from "./src/config/env.js";
import { connectDB } from "./src/config/db.js";
import { syncUploadedImageCategories } from "./src/services/catalogMigration.js";
import { syncUploadedProductCatalog } from "./src/services/uploadedProductSeed.js";
import { ensureFourTrendingProducts } from "./src/services/trendingProducts.js";

await connectDB();

// The built-in demo catalogue used to be re-applied on EVERY start, which silently reverted
// anything edited in the admin panel (name, price, category, images...) and brought deleted
// products back. It now only runs when explicitly requested: SEED_UPLOAD_CATALOG=true
if (process.env.SEED_UPLOAD_CATALOG === "true") {
  try { await syncUploadedProductCatalog(); } catch (error) { console.error("Uploaded product catalog seed failed:", error); }
  try { await syncUploadedImageCategories(); } catch (error) { console.error("Upload catalog sync failed:", error); }
}
try { await ensureFourTrendingProducts(); } catch (error) { console.error("Trending product setup failed:", error); }
app.listen(env.PORT, () => console.log(`Gloriya API running on port ${env.PORT}`));
