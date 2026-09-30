# Gloriya Jewellery — React + Node.js + MongoDB

This version uses React on the frontend and Node.js/Express with MongoDB Atlas for persistent application data.

## Backend

```bash
cd backend
cp .env.example .env
# Put the real MongoDB Atlas connection string in MONGODB_URI
npm install
npm run dev
```

The server will refuse to start when `MONGODB_URI` is missing. This prevents accidental fallback to local JSON storage.

## MongoDB collections

- `users`
- `products`
- `orders`
- `discounts`

Existing numeric `id` fields are retained for compatibility with the current frontend/API contract.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Set the frontend API base URL according to the existing frontend configuration.

## Production

Backend:

```bash
npm install
npm start
```

Frontend:

```bash
npm install
npm run build
```

## Important

The backend does not use `data/*.json` for runtime storage. MongoDB is the source of truth.
