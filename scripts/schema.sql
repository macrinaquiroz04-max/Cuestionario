-- ============================================================
-- Survey Platform — Schema completo para Supabase / PostgreSQL
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Extensión para UUIDs (ya disponible en Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Tabla: users (administradores)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Tabla: surveys
-- ============================================================
CREATE TABLE IF NOT EXISTS surveys (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  question    TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT true,
  close_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Tabla: options
-- ============================================================
CREATE TABLE IF NOT EXISTS options (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  survey_id  TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  "order"    INT  NOT NULL
);

-- ============================================================
-- Tabla: votes
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  survey_id   TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  option_id   TEXT NOT NULL REFERENCES options(id),
  ip_hash     TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(survey_id, ip_hash)
);

-- ============================================================
-- Índices para rendimiento bajo carga alta
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_votes_survey_id   ON votes(survey_id);
CREATE INDEX IF NOT EXISTS idx_votes_ip_hash      ON votes(ip_hash);
CREATE INDEX IF NOT EXISTS idx_votes_survey_ip    ON votes(survey_id, ip_hash);
CREATE INDEX IF NOT EXISTS idx_options_survey_id  ON options(survey_id);
CREATE INDEX IF NOT EXISTS idx_surveys_is_active  ON surveys(is_active);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at DESC);

-- ============================================================
-- Row Level Security (opcional — desactivar si se usa service-role key)
-- ============================================================
ALTER TABLE users    DISABLE ROW LEVEL SECURITY;
ALTER TABLE surveys  DISABLE ROW LEVEL SECURITY;
ALTER TABLE options  DISABLE ROW LEVEL SECURITY;
ALTER TABLE votes    DISABLE ROW LEVEL SECURITY;
