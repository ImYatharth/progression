-- ─────────────────────────────────────────────────────────────
-- Progression – Database Schema
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
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  notes      text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
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

-- ── Indexes ───────────────────────────────────────────────────

create index if not exists workouts_user_id_idx on workouts(user_id);
create index if not exists workouts_date_idx on workouts(date);
create index if not exists workout_exercises_workout_id_idx on workout_exercises(workout_id);
create index if not exists sets_workout_exercise_id_idx on sets(workout_exercise_id);

-- ── Row Level Security ─────────────────────────────────────────

alter table exercises enable row level security;
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table sets enable row level security;

-- exercises: everyone can read, only authenticated users can insert custom ones
create policy "Anyone can read exercises"
  on exercises for select
  using (true);

create policy "Authenticated users can insert custom exercises"
  on exercises for insert
  to authenticated
  with check (is_custom = true);

-- workouts: users own their workouts
create policy "Users can CRUD their own workouts"
  on workouts for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- workout_exercises: scoped via workouts
create policy "Users can CRUD their own workout_exercises"
  on workout_exercises for all
  to authenticated
  using (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
        and workouts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts
      where workouts.id = workout_exercises.workout_id
        and workouts.user_id = auth.uid()
    )
  );

-- sets: scoped via workout_exercises → workouts
create policy "Users can CRUD their own sets"
  on sets for all
  to authenticated
  using (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from workout_exercises we
      join workouts w on w.id = we.workout_id
      where we.id = sets.workout_exercise_id
        and w.user_id = auth.uid()
    )
  );
