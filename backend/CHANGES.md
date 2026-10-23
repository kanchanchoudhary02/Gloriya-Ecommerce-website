# Gloriya – what was changed

## Why admin changes / images were not showing on the website
1. Backend re-applied a built-in demo catalogue on EVERY start and overwrote name/price/category/images of those products
   (and re-created deleted ones). Now it never runs unless `SEED_UPLOAD_CATALOG=true`, and even then it only inserts.
2. Images uploaded in admin were saved on the server disk, which Render wipes on every deploy/restart.
   Now stored in MongoDB (GridFS) and served from `/uploads/<file>`.
3. Images were saved as `/uploads/x.jpg` (resolved against gloriya.in) or as `http://localhost:5000/...` (dev).
   API now returns full links to the API server; old localhost/relative links are repaired automatically.
4. Editing a product in admin re-saved the *resolved* image link (or the placeholder image). Now the original link is kept.
5. Saving a product in admin wiped the "notify me" reminder list – fixed.
6. Product page ignored most admin fields. It now shows Material, Stone/Metal colour, custom attributes, Size, SKU,
   weight, dimensions, tags and the product's own Return Policy.
7. Fake sample products (ids 1-4 / empty shop) were returned by the API – removed.
8. "Notify me" button only showed a message – it now saves the email so the back-in-stock mail is sent.

## New: attributes dropdowns (admin)
Attribute dropdown -> Material / Stone color / Metal color / Other, then a second dropdown with the options:
Material: Brass, Silver | Stone: Green, Blue, Red, Pink, Yellow, Mint, Orange | Metal: Gold, Silver, Rose Gold, Oxidize.

## New: colour combinations -> image
Admin > Add/Edit product > "Colour combinations & images": pick stone colour + metal colour + upload an image.
Product page shows Stone color / Metal color chips; choosing a combination jumps to its image.
Cart and order keep the chosen combination (separate cart lines per combination). Shop cards of such products open
the product page so the customer can choose.

## New: "You may also like" is editable
Admin > Add/Edit product > "You may also like" products: search and tick up to 4 products.
If none are picked, same-category products are shown automatically (then others).

## Share button
Opens a share dialog (WhatsApp, Facebook, Instagram, X, Telegram, Email, Copy link, native "More apps").
The shared link is `<API>/meta/product/<id>` which carries title, price and photo for previews and then sends people
to the product page. No more "one moment please" page; photo-only sharing is gone.

## Footer
Instagram + Facebook icons in the bottom bar (and Facebook in Contact). 
**Put your real Facebook page URL in `frontend/src/pages/markup/footer.js` (`FACEBOOK_URL`).**
