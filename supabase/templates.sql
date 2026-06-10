-- ─────────────────────────────────────────────────────────────
-- Progression – Workout Templates migration
-- Run this in the Supabase SQL Editor (existing DBs only;
-- fresh installs get these tables from schema.sql)
-- ─────────────────────────────────────────────────────────────

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

create index if not exists template_exercises_template_id_idx on template_exercises(template_id);

alter table templates enable row level security;
alter table template_exercises enable row level security;

create policy "Open access" on templates for all using (true) with check (true);
create policy "Open access" on template_exercises for all using (true) with check (true);
