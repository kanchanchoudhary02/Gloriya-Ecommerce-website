# Gloriya Catalogue Update

- Existing catalogue products preserved.
- 171 curated frontend product images added as products.
- Category counts: Ring: 125, Bracelet: 14, Necklace: 32
- Every seeded product has a local `/uploads/...` image path and inventory 25.
- Product IDs 1001+ are reserved for this uploaded-image catalogue.


### Gallery grouping
Each entry in `UPLOAD_CATALOG` is one storefront product. Every file in its `files` array is stored as that product's gallery, so the shop shows one card and Quick View/Product Details can browse all images for that product.
