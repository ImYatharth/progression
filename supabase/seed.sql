-- ─────────────────────────────────────────────────────────────
-- Progression – Seed Data
-- Run this AFTER schema.sql in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

insert into exercises (name, muscle_group, is_custom) values
  -- Chest
  ('Bench Press', 'Chest', false),
  ('Incline Bench Press', 'Chest', false),
  ('Decline Bench Press', 'Chest', false),
  ('Dumbbell Fly', 'Chest', false),
  ('Cable Crossover', 'Chest', false),
  ('Push-Up', 'Chest', false),
  ('Chest Dip', 'Chest', false),
  ('Pec Deck', 'Chest', false),

  -- Back
  ('Deadlift', 'Back', false),
  ('Pull-Up', 'Back', false),
  ('Chin-Up', 'Back', false),
  ('Bent-Over Row', 'Back', false),
  ('Seated Cable Row', 'Back', false),
  ('Lat Pulldown', 'Back', false),
  ('T-Bar Row', 'Back', false),
  ('Single-Arm Dumbbell Row', 'Back', false),
  ('Face Pull', 'Back', false),

  -- Legs
  ('Squat', 'Legs', false),
  ('Front Squat', 'Legs', false),
  ('Leg Press', 'Legs', false),
  ('Romanian Deadlift', 'Legs', false),
  ('Leg Curl', 'Legs', false),
  ('Leg Extension', 'Legs', false),
  ('Calf Raise', 'Legs', false),
  ('Hack Squat', 'Legs', false),
  ('Lunges', 'Legs', false),
  ('Bulgarian Split Squat', 'Legs', false),
  ('Goblet Squat', 'Legs', false),
  ('Sumo Deadlift', 'Legs', false),

  -- Shoulders
  ('Overhead Press', 'Shoulders', false),
  ('Arnold Press', 'Shoulders', false),
  ('Lateral Raise', 'Shoulders', false),
  ('Front Raise', 'Shoulders', false),
  ('Rear Delt Fly', 'Shoulders', false),
  ('Upright Row', 'Shoulders', false),
  ('Shrugs', 'Shoulders', false),
  ('Cable Lateral Raise', 'Shoulders', false),

  -- Arms
  ('Barbell Curl', 'Arms', false),
  ('Dumbbell Curl', 'Arms', false),
  ('Hammer Curl', 'Arms', false),
  ('Preacher Curl', 'Arms', false),
  ('Cable Curl', 'Arms', false),
  ('Tricep Pushdown', 'Arms', false),
  ('Skull Crusher', 'Arms', false),
  ('Overhead Tricep Extension', 'Arms', false),
  ('Tricep Dip', 'Arms', false),
  ('Close-Grip Bench Press', 'Arms', false),

  -- Core
  ('Plank', 'Core', false),
  ('Crunch', 'Core', false),
  ('Leg Raise', 'Core', false),
  ('Russian Twist', 'Core', false),
  ('Ab Rollout', 'Core', false),
  ('Cable Crunch', 'Core', false),
  ('Hanging Knee Raise', 'Core', false),
  ('Side Plank', 'Core', false),

  -- Cardio
  ('Treadmill Run', 'Cardio', false),
  ('Cycling', 'Cardio', false),
  ('Rowing Machine', 'Cardio', false),
  ('Jump Rope', 'Cardio', false),
  ('Stair Climber', 'Cardio', false),
  ('Elliptical', 'Cardio', false)

on conflict (name) do nothing;
