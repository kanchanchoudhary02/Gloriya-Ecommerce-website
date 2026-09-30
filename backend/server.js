import app from "./src/app.js";
import { env } from "./src/config/env.js";
import { connectDB } from "./src/config/db.js";
import { syncUploadedImageCategories } from "./src/services/catalogMigration.js";
import { syncUploadedProductCatalog } from "./src/services/uploadedProductSeed.js";
import { ensureFourTrendingProducts } from "./src/services/trendingProducts.js";

await connectDB();
try { await syncUploadedImageCategories(); } catch (error) { console.error("Upload catalog sync failed:", error); }
try { await syncUploadedProductCatalog(); } catch (error) { console.error("Uploaded product catalog seed failed:", error); }
try { await ensureFourTrendingProducts(); } catch (error) { console.error("Trending product setup failed:", error); }
app.listen(env.PORT, () => console.log(`Gloriya API running on port ${env.PORT}`));
