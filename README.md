# Spreetail Shared Expenses Hub

A production-ready monorepo Shared Expenses Management Web Application with active/inactive membership histories, multi-currency balance spreadsheets, automated debt simplification, and a CSV import anomaly engine.

* **Live Deployment URL**: [https://shared-expenses-management-web-appl.vercel.app/](https://shared-expenses-management-web-appl.vercel.app/)

## Tech Stack
* **Frontend**: React.js, Tailwind CSS, Recharts, Lucide React, Vite.
* **Backend**: Node.js, Express.js, Prisma ORM, JWT, SQLite (development) & PostgreSQL (production), Zod.
* **Database**: SQLite (`dev.db` generated locally) / PostgreSQL.

---

## Local Setup & Installation

Since Node.js/NPM may not be installed globally, a portable Node environment has been configured inside `D:\placements\SPREETAIL\node-portable`.

### 1. Database Migrations & Seed
To initialize the SQLite database and seed initial group members (Aisha, Rohan, Priya, Meera, Dev, Sam) and exchange rates matching the CSV timeline:

Create a file `run_backend_setup.bat` in the root:
```bat
@echo off
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd backend
call npx prisma migrate dev --name init
call node prisma/seed.js
```
Then execute it to create `backend/prisma/dev.db` and seed initial database states.

### 2. Run Backend Server
Start the Express server on port 5000:
```bat
@echo off
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd backend
npm run dev
```

### 3. Run Frontend Dev Server
Start the Vite dev server on port 5173:
```bat
@echo off
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd frontend
npm run dev
```

### 4. Run Jest Test Suite
To execute backend and algorithm tests:
```bat
@echo off
set PATH=D:\placements\SPREETAIL\node-portable;%PATH%
cd backend
npm test
```

---

## User Authentication & Setup Guide

### 1. Local Development (Pre-seeded Users)
For local development, the database is pre-seeded with 6 users:
* **Emails**: `aisha@example.com`, `rohan@example.com`, `priya@example.com`, `meera@example.com`, `dev@example.com`, `sam@example.com`
* **Default Password**: `password123`

### 2. Production Environment (Live Deployment)
Since your production database on Render/PostgreSQL is brand new and empty:
* **First Action**: You **must click "Sign Up"** (Create Account) at the bottom of the login panel to register a new user first.
* Once registered, you will be automatically logged in and can create roommate groups or upload CSV files!

---

## Architecture Description
* **`backend/src/services/balances.js`**: Contains the core balance calculations and greedy transaction minimizer.
* **`backend/src/services/importer.js`**: Houses the anomaly detection rules for checking duplicates, unregistered users, active date timeline checks, currency issues, and math splits.
* **`frontend/src/pages/CsvImporter.jsx`**: Displays a detailed review of anomalies and allows room for interactive user corrections before writing imports.
