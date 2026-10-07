# FPU School Management System

**Federal Polytechnic Ugep** — *Citadel of Technical Excellence*
Cross River State, Nigeria

A full-featured school management system built with **Node.js 20**, **Express 5**, **PostgreSQL 16**, and **Drizzle ORM**. Vanilla JS frontend — no build step.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env
# (edit DATABASE_URL if you're not using the bundled Docker Postgres)

# 3. Start Postgres in Docker
docker compose up -d db

# 4. Run migrations + seed
npm run migrate
npm run seed
npm run seed:bank

# 5. Start the dev server
npm run dev