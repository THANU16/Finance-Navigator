BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  sub_category text,
  units numeric(18,6),
  nav numeric(18,6),
  price_per_unit numeric(18,6),
  invested_value numeric(18,2) NOT NULL DEFAULT 0,
  target_percent numeric(5,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'LKR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS valuations (
  id serial PRIMARY KEY,
  asset_id integer NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  value numeric(18,2) NOT NULL,
  units numeric(18,6),
  nav numeric(18,6),
  price_per_unit numeric(18,6),
  date text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  tag text NOT NULL,
  balance numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'LKR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount numeric(18,2) NOT NULL,
  asset_id integer,
  source_account_id integer,
  destination_account_id integer,
  date text NOT NULL,
  tag text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sip_configs (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  monthly_amount numeric(18,2) NOT NULL DEFAULT 0,
  equity_percent numeric(5,2) NOT NULL DEFAULT 60,
  debt_percent numeric(5,2) NOT NULL DEFAULT 20,
  metals_percent numeric(5,2) NOT NULL DEFAULT 10,
  opportunity_percent numeric(5,2) NOT NULL DEFAULT 10,
  asset_allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sip_history (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month text NOT NULL,
  total_amount numeric(18,2) NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id serial PRIMARY KEY,
  user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  emergency_fund_required numeric(18,2) NOT NULL DEFAULT 0,
  emergency_fund_low_threshold numeric(5,2) NOT NULL DEFAULT 80,
  emergency_fund_critical_threshold numeric(5,2) NOT NULL DEFAULT 50,
  rebalancing_drift_tolerance numeric(5,2) NOT NULL DEFAULT 5,
  crash_drop_levels jsonb NOT NULL DEFAULT '[10,15,20,25]'::jsonb,
  crash_deployment_strategy jsonb NOT NULL DEFAULT '{"10":25,"15":50,"20":75,"25":100}'::jsonb,
  currency text NOT NULL DEFAULT 'LKR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deployments (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drop_percent numeric(5,2) NOT NULL,
  deployed_amount numeric(18,2) NOT NULL,
  asset_id integer,
  note text,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at ON password_resets(expires_at);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_valuations_asset_id ON valuations(asset_id);
CREATE INDEX IF NOT EXISTS idx_valuations_date ON valuations(date);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tag ON accounts(tag);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_sip_history_user_id ON sip_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sip_history_month ON sip_history(month);
CREATE INDEX IF NOT EXISTS idx_deployments_user_id ON deployments(user_id);
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_at ON deployments(deployed_at);

COMMIT;
