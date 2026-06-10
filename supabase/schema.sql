-- ─────────────────────────────────────────────────────────────
-- Progression – Database Schema (no-auth, personal use)
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── Tables ────────────────────────────────────────────────────

create table if not exists exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,
  muscle_group  text not null,
  is_custom     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists workouts (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references workouts(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  order_index integer not null default 0
);

create table if not exists sets (
  id                   uuid primary key default gen_random_uuid(),
  workout_exercise_id  uuid not null references workout_exercises(id) on delete cascade,
  set_number           integer not null,
  reps                 integer,
  weight_kg            numeric,
  duration_seconds     integer,
  notes                text
);

create table if not exists templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references templates(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  order_index  integer not null default 0,
  default_sets integer not null default 3
);

-- ── Indexes ───────────────────────────────────────────────────

create index if not exists workouts_date_idx on workouts(date);
create index if not exists workout_exercises_workout_id_idx on workout_exercises(workout_id);
create index if not exists sets_workout_exercise_id_idx on sets(workout_exercise_id);
create index if not exists template_exercises_template_id_idx on template_exercises(template_id);

-- ── Row Level Security (open — personal use only) ─────────────

alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;
alter table templates enable row level security;
alter table template_exercises enable row level security;

create policy "Open access" on exercises for all using (true) with check (true);
create policy "Open access" on workouts for all using (true) with check (true);
create policy "Open access" on workout_exercises for all using (true) with check (true);
create policy "Open access" on sets for all using (true) with check (true);
create policy "Open access" on templates for all using (true) with check (true);
create policy "Open access" on template_exercises for all using (true) with check (true);
