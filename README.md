# Gloriya Jewellery — React + Node.js/Express Migration

This project migrates the supplied Gloriya Jewellery application from HTML/Python to React + Node.js/Express while preserving the existing markup, CSS, assets, URL structure, browser storage keys, API paths, request/response shapes, order/payment flow, and file-backed data format.

## Project structure

- `frontend/` — Vite + React multi-page frontend
- `backend/` — Node.js + Express API
- `frontend/public/legacy/` — existing browser JavaScript retained as JavaScript because the requested migration is HTML → React and Python → Node/Express
- `backend/data/` — existing JSON-backed application data

## Run locally

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:5173`.

The Vite dev server proxies `/api` and `/uploads` to the Node backend.

## Environment

Copy:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Keep the existing backend environment variable names. Do not commit real secrets.

Frontend API requests use `http://localhost:5000/api` on localhost and the Render backend API in production.

Backend keeps the existing names including `MAIL_*`, `MAILJET_*`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`.

## Production

Build the frontend:

```bash
cd frontend
npm run build
```

Start the backend:

```bash
cd backend
npm start
```

Deploy the generated `frontend/dist` with the same `.html` entry URLs as the original application, or configure the web server to serve those generated files directly.

## Important migration notes

- Existing CSS is reused rather than redesigned.
- Existing image/video/font/icon assets are retained.
- Existing browser-side JavaScript behavior is retained and loaded after the React DOM is mounted.
- Existing JSON data files are retained.
- Existing Werkzeug `scrypt:*` password hashes are verified directly by Node's `crypto.scryptSync`, so existing accounts remain compatible.
- Razorpay verification uses HMAC-SHA256 with the existing `RAZORPAY_KEY_SECRET`.
- Product, order, admin, discount, reminder, upload, auth, email and metadata API paths are preserved.
