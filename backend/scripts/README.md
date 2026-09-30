# MongoDB data migration

The application no longer reads or writes runtime JSON data. Runtime data is stored in MongoDB Atlas.

If you have legacy JSON exports from the previous version, import them into the MongoDB collections `users`, `products`, `orders`, and `discounts` before going live. Preserve the existing numeric `id` fields so existing frontend URLs and API payloads continue to work.

Do not put production secrets in source control. Configure `MONGODB_URI` and the other variables in `.env`.
