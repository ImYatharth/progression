# Progression — Workout Tracker

A mobile-first workout logging app built with Next.js 14 (App Router), Supabase, Tailwind CSS, and shadcn/ui.

---

## Stack

- **Next.js 14** — App Router, Server Components, Middleware
- **Supabase** — Auth + PostgreSQL database with Row Level Security
- **Tailwind CSS** — Dark theme with electric-lime accent
- **shadcn/ui** — Component library
- **TypeScript** throughout
- **Recharts** — Exercise progress charts

---

## Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New project** and fill in the details
3. Wait for the project to finish provisioning (~1 min)

### 2. Run the database schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/schema.sql` from this repo and paste the full contents → click **Run**
3. Then open `supabase/seed.sql` and paste it → click **Run**

This creates the four tables (`exercises`, `workouts`, `workout_exercises`, `sets`), enables Row Level Security with the correct policies, and seeds ~80 common exercises.

### 3. Set environment variables

1. In your Supabase dashboard, go to **Project Settings → API**
2. Copy the **Project URL** and **anon/public** key
3. Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account and start logging workouts.

---

## Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**

Vercel's free Hobby tier is sufficient for personal use.

---

## Features

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Monthly calendar with workout highlights, stats strip |
| Workout Log | `/workout/[date]` | Log exercises, sets, reps, weight with "last time" comparison |
| Exercise History | `/exercise/[id]` | All sessions + max-weight progress chart |
| Exercise Library | `/exercises` | Browse & filter all exercises, add custom ones |
| Login | `/login` | Email + password auth |
| Sign Up | `/signup` | Account creation |
