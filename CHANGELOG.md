# Update Summary — Gloriya Jewellery

## Fixed / added
- Shop dropdown is click-to-open and stays open while moving the pointer to categories.
- Navbar is sticky while scrolling.
- Product/upload images now resolve from the backend `/uploads` origin instead of incorrectly looking on the frontend origin.
- Added a separate Admin > Trending tab with a maximum of 4 trending images.
- Homepage trending now reads the dedicated trending image set.
- Logged-in wishlist and cart are persisted against the user's account/email and restored after login.
- Added cart/wishlist API persistence.
- Payment-completion order email includes the delivery message: "Your product will be delivered within 8-9 working days after successful payment."
- Customer order history button is labeled "View Your Bill" and opens the customer receipt after completed payment.
- Existing forgot-password/reset flow is retained.
- Profile edit flow is retained.
- Added small admin/trending UI spacing polish.

## Bill
The existing customer receipt endpoint is still used after successful Razorpay verification. The supplied bill format is the reference for the order-bill requirement.

## Validation
- Backend JavaScript syntax checked successfully.
- Modified frontend legacy JavaScript syntax checked successfully.
- Vite production build could not be executed in this environment because the bundled frontend `node_modules` is missing Rollup's optional Linux native package. Source files themselves were syntax-checked.

## 2026-09-28 — image + trending fix
- Fixed local/production product image resolution by using the shared `frontend/public/uploads` directory for uploaded media and relative `/uploads/...` URLs.
- Fixed admin product image previews and storefront image loading.
- Trending is now product-based and limited to a maximum of 4 products.
- Added Add to Trending / Remove from Trending controls directly on admin product cards.
- Added a dedicated Trending tab showing the currently selected products.
- Fresh catalogues are seeded with 4 trending products; manual removals are preserved.
- Homepage Trending now reads the selected product images directly.
- Frontend API base defaults to `/api` so localhost and same-origin production use the correct API.
