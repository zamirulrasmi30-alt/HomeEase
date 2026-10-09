# HomeEase — Home Service Booking & Management System

A high-end, glassmorphism-styled home services booking platform built with **HTML5 + CSS3 + JavaScript**, **Node.js + Express**, and **Supabase**.

## Features
- Glassmorphism UI with animated gradient orbs, 3D embeds (Spline), and smooth scroll/tab navigation
- Services: Home Cleaning, AC Mechanic, Vehicle Mechanic, Plumber, Electrician
- Dedicated category pages with interactive 3D model headers
- Worker cards with photo, phone, experience, ratings, and **View ID Card** modal
- Interactive star-rating review submission per worker
- Full Admin Dashboard (login: `admin` / `admin123`):
  - Add / Edit / Delete services
  - Add / Edit / Delete workers for any category
  - Local photo + ID-card upload via `<input type="file">`
- Runs fully out-of-the-box with in-memory storage; swap in Supabase credentials for persistence

## Quick Start

1. **Install dependencies**
   ```
   npm install
   ```

2. **Run the server**
   ```
   npm start
   ```
   Visit `http://localhost:3000`

3. **(Optional) Connect Supabase**
   - Create a project at [supabase.com](https://supabase.com)
   - Run [`supabase_schema.sql`](./supabase_schema.sql) in the SQL Editor
   - Create `.env` from `.env.example` with your project URL + anon key
   - Restart the server

   Without `.env`, the app runs with in-memory demo data (restarts lose changes).

## Project Structure
```
├── server.js             # Express API + Supabase client + file uploads
├── package.json
├── .env.example          # Supabase credentials template
├── supabase_schema.sql   # DB schema + seed data
└── public/
    ├── index.html        # Single-page frontend
    ├── style.css         # Glassmorphism design system
    ├── app.js            # Frontend app logic (nav, services, workers, reviews)
    ├── admin.js          # Admin dashboard logic
    └── uploads/          # Uploaded worker photos / ID cards
```

## API Endpoints
| Method | Route                  | Purpose                          |
|--------|------------------------|----------------------------------|
| GET    | `/api/services`        | List all services                |
| GET    | `/api/services/:category` | Get service by category slug  |
| POST   | `/api/services`        | Create service                   |
| PUT    | `/api/services/:id`    | Update service                   |
| DELETE | `/api/services/:id`    | Delete service + its workers     |
| GET    | `/api/workers`         | List workers (`?service_id=`)    |
| GET    | `/api/workers/:id`     | Get worker                       |
| POST   | `/api/workers`         | Create worker (multipart, photo/ID card) |
| PUT    | `/api/workers/:id`     | Update worker (multipart)        |
| DELETE | `/api/workers/:id`     | Delete worker                    |
| GET    | `/api/reviews/:workerId` | List reviews for a worker      |
| POST   | `/api/reviews`         | Submit review (updates avg rating) |
| POST   | `/api/upload`          | Generic single-file upload       |