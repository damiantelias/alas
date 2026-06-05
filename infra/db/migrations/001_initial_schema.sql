-- Alas — Migración inicial
-- Ejecutar: psql $DATABASE_URL -f 001_initial_schema.sql

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── ENUM types ────────────────────────────────────────────────────────────────

CREATE TYPE subscription_tier AS ENUM ('free', 'plus', 'pro');
CREATE TYPE match_status       AS ENUM ('active', 'unmatched');
CREATE TYPE message_type       AS ENUM ('text', 'image', 'emoji');
CREATE TYPE like_action        AS ENUM ('like', 'pass', 'super');
CREATE TYPE report_reason      AS ENUM ('fake', 'harassment', 'spam', 'inappropriate', 'other');
CREATE TYPE report_status      AS ENUM ('pending', 'resolved');
CREATE TYPE community_type     AS ENUM ('city', 'identity', 'interest');
CREATE TYPE sub_status         AS ENUM ('active', 'cancelled', 'expired');
CREATE TYPE payment_provider   AS ENUM ('mercadopago', 'stripe');

-- ── USERS ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email       ON users(email);
CREATE INDEX idx_users_last_seen   ON users(last_seen_at);
CREATE INDEX idx_users_subscription ON users(subscription_tier);

-- ── PROFILES ──────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name        VARCHAR(30) NOT NULL,
  bio                 TEXT,
  birthdate           DATE NOT NULL,
  gender_identity     VARCHAR(60) NOT NULL,
  sexual_orientation  VARCHAR(60) NOT NULL,
  looking_for         VARCHAR(20)[] NOT NULL DEFAULT '{}',
  location            GEOGRAPHY(POINT, 4326),
  city                VARCHAR(80) NOT NULL DEFAULT '',
  country_code        CHAR(2) NOT NULL DEFAULT 'AR',
  photos              JSONB NOT NULL DEFAULT '[]',
  is_incognito        BOOLEAN NOT NULL DEFAULT FALSE,
  is_profile_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id      ON profiles(user_id);
CREATE INDEX idx_profiles_location     ON profiles USING GIST(location);
CREATE INDEX idx_profiles_country      ON profiles(country_code);
CREATE INDEX idx_profiles_gender       ON profiles(gender_identity);
CREATE INDEX idx_profiles_orientation  ON profiles(sexual_orientation);

-- ── LIKES ─────────────────────────────────────────────────────────────────────

CREATE TABLE likes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action       like_action NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id)
);

CREATE INDEX idx_likes_from    ON likes(from_user_id);
CREATE INDEX idx_likes_to      ON likes(to_user_id);
CREATE INDEX idx_likes_created ON likes(created_at);

-- ── MATCHES ───────────────────────────────────────────────────────────────────

CREATE TABLE matches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          match_status NOT NULL DEFAULT 'active',
  matched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  CONSTRAINT different_users CHECK (user_a_id <> user_b_id),
  UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_matches_user_a       ON matches(user_a_id);
CREATE INDEX idx_matches_user_b       ON matches(user_b_id);
CREATE INDEX idx_matches_last_message ON matches(last_message_at DESC NULLS LAST);

-- ── MESSAGES ──────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id   UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  type       message_type NOT NULL DEFAULT 'text',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_match   ON messages(match_id, created_at DESC);
CREATE INDEX idx_messages_sender  ON messages(sender_id);
CREATE INDEX idx_messages_unread  ON messages(match_id) WHERE read_at IS NULL;

-- ── COMMUNITIES ───────────────────────────────────────────────────────────────

CREATE TABLE communities (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(80) NOT NULL,
  slug         VARCHAR(80) NOT NULL UNIQUE,
  description  TEXT,
  type         community_type NOT NULL,
  country_code CHAR(2) NOT NULL,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE community_members (
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- ── REPORTS ───────────────────────────────────────────────────────────────────

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      report_reason NOT NULL,
  details     TEXT,
  status      report_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_reported ON reports(reported_id);
CREATE INDEX idx_reports_status   ON reports(status);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────────────────────

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            payment_provider NOT NULL,
  external_id         VARCHAR(255) NOT NULL,
  tier                subscription_tier NOT NULL,
  status              sub_status NOT NULL DEFAULT 'active',
  current_period_end  TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_expiry ON subscriptions(current_period_end) WHERE status = 'active';

-- ── Trigger: updated_at en profiles ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Datos iniciales: comunidades base ────────────────────────────────────────

INSERT INTO communities (id, name, slug, description, type, country_code) VALUES
  (uuid_generate_v4(), 'Buenos Aires Queer',  'bsas-queer',     'La comunidad queer de Buenos Aires', 'city',     'AR'),
  (uuid_generate_v4(), 'CDMX Queer',          'cdmx-queer',     'Comunidad LGBTQ+ de Ciudad de México', 'city',   'MX'),
  (uuid_generate_v4(), 'São Paulo Queer',      'sp-queer',       'Comunidade LGBTQ+ de São Paulo', 'city',        'BR'),
  (uuid_generate_v4(), 'Trans LATAM',          'trans-latam',    'Espacio trans y no-binarie para toda LATAM', 'identity', 'AR'),
  (uuid_generate_v4(), 'Lesbianas LATAM',      'lesbianas-latam','Espacio para mujeres queer de toda LATAM', 'identity', 'AR'),
  (uuid_generate_v4(), 'Gay LATAM',            'gay-latam',      'Comunidad gay masculina de LATAM', 'identity',  'AR');

-- Columna show_me: géneros que el usuario quiere ver (configuración manual)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_me VARCHAR(60)[] DEFAULT '{}';
