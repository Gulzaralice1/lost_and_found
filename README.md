# Lost and Found System

React frontend and Node.js/Express API for reporting lost items and connecting them with their owners. It can run locally without paid hosting, AI credits, or an email account.

## Requirements

- Node.js 18 or newer
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/lost_and_found`)

## Install

From the project directory, install each app's dependencies:

```powershell
cd backend
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
cd ..\frontend
npm install
```

Set a private JWT secret in `backend/.env`. Generate one from the `backend` directory:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Replace `JWT_SECRET` in `.env` with the generated value. The local MongoDB URI is already configured in `.env.example`. Keep `.env` private; Git ignores it.

## Development

Run the API and React development server in separate PowerShell windows.

Backend:

```powershell
cd backend
npm run dev
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the frontend terminal (normally <http://localhost:5173>). The Vite server proxies API, uploads, and Socket.IO requests to the Node.js backend at port 5000.

## Production-style local run

Build React, then start the backend, which serves the built app:

```powershell
cd frontend
npm run build
cd ..\backend
npm start
```

Open <http://localhost:5000> or the admin panel at <http://localhost:5000/admin>. Check database connectivity at <http://localhost:5000/api/health>.

Email notifications are optional; leave the `EMAIL_*` values blank to run without an email provider.

## Project structure

- `frontend/src/` — React application
- `frontend/css/` — app and admin styles
- `backend/` — Node.js/Express API, MongoDB models, auth, and image uploads

## Features

- User registration and login
- Lost and found reports with optional image uploads
- Multi-word item search across titles, descriptions, categories, and locations
- Owners can mark reports resolved; matched listings are resolved together
- Item matching and Socket.IO notifications
- User dashboard and admin management panel
