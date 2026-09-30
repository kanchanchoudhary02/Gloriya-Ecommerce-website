# Gloriya deployment notes

## Required server environment
Copy `backend/.env.example` to `backend/.env` on the server and fill in the real values.

Required for production:
- `MONGODB_URI`
- `SESSION_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SITE_ORIGIN`
- `CORS_ORIGIN`

Never put `RAZORPAY_KEY_SECRET`, `SESSION_SECRET`, MongoDB credentials, or email API keys in frontend files or Git.



## Admin login setup (important)
The admin dashboard uses signed bearer tokens. `backend/.env` must contain a strong persistent `SESSION_SECRET`; without it, login succeeds only up to password verification and the server returns an authentication-configuration error.

If the account already exists but is not an admin, run:

```bash
cd backend
ADMIN_EMAIL="your-admin-email@example.com" npm run set-admin
```

Then restart the backend and log in again. The admin API also verifies the role server-side, so changing the browser's `user` value is not enough.

## Admin authentication
The login API now returns a signed authentication token. Admin API routes require `Authorization: Bearer <token>` and verify the user's admin role server-side.

## Trending products
Open Admin Panel → Products → Edit/Add Product → enable `Show this product in Trending Products`.
Only products marked as trending are loaded into the homepage slider.

## Uploaded jewellery images
The backend contains a visual catalog mapping for the uploaded jewellery assets. Products whose primary image/media matches those assets are automatically assigned the reviewed category, and their product gallery is enriched with the matching product-view images.

Non-product assets (logos, screenshots, and unrelated dark artwork) are intentionally excluded from jewellery categories.

## Uploaded Jewellery Image Catalog
- The backend now syncs the curated product images in `frontend/public/uploads` from `backend/src/data/uploadCatalog.js` into MongoDB on startup.
- Each curated product image is represented as a storefront product so all 171 catalogued product images are available in Shop.
- Categories currently seeded from the reviewed catalog: Ring, Bracelet, Necklace.
- Seeded product IDs start at 1001 so existing products are not overwritten.
- Local image URLs use `/uploads/<filename>` and are served by the frontend/VPS static files.
- The products endpoint now supports up to 1000 products (default 500), so the complete catalog can load.
