-- Exported schema creation script
-- Source: local PostgreSQL
-- Target: Neon / Vercel Postgres
-- Fixed: replaced nextval('*_id_seq') defaults with GENERATED ALWAYS AS IDENTITY
--        (no separate sequence objects needed), and removed OWNER TO postgres
--        statements (Neon doesn't have a "postgres" superuser role by default).

-- Table: public.users

-- DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users
(
    id integer GENERATED ALWAYS AS IDENTITY,
    name text COLLATE pg_catalog."default" NOT NULL,
    email text COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
);


-- Table: public.accounts

-- DROP TABLE IF EXISTS public.accounts;

CREATE TABLE IF NOT EXISTS public.accounts
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    type text COLLATE pg_catalog."default" NOT NULL,
    tag text COLLATE pg_catalog."default" NOT NULL,
    balance numeric(18,2) NOT NULL DEFAULT 0,
    currency text COLLATE pg_catalog."default" NOT NULL DEFAULT 'LKR'::text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT accounts_pkey PRIMARY KEY (id),
    CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_accounts_tag

-- DROP INDEX IF EXISTS public.idx_accounts_tag;

CREATE INDEX IF NOT EXISTS idx_accounts_tag
    ON public.accounts USING btree
    (tag COLLATE pg_catalog."default" ASC NULLS LAST);

-- Index: idx_accounts_user_id

-- DROP INDEX IF EXISTS public.idx_accounts_user_id;

CREATE INDEX IF NOT EXISTS idx_accounts_user_id
    ON public.accounts USING btree
    (user_id ASC NULLS LAST);


-- Table: public.assets

-- DROP TABLE IF EXISTS public.assets;

CREATE TABLE IF NOT EXISTS public.assets
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    name text COLLATE pg_catalog."default" NOT NULL,
    category text COLLATE pg_catalog."default" NOT NULL,
    sub_category text COLLATE pg_catalog."default",
    units numeric(18,6),
    nav numeric(18,6),
    price_per_unit numeric(18,6),
    invested_value numeric(18,2) NOT NULL DEFAULT 0,
    target_percent numeric(5,2) NOT NULL DEFAULT 0,
    currency text COLLATE pg_catalog."default" NOT NULL DEFAULT 'LKR'::text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT assets_pkey PRIMARY KEY (id),
    CONSTRAINT assets_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_assets_category

-- DROP INDEX IF EXISTS public.idx_assets_category;

CREATE INDEX IF NOT EXISTS idx_assets_category
    ON public.assets USING btree
    (category COLLATE pg_catalog."default" ASC NULLS LAST);

-- Index: idx_assets_user_id

-- DROP INDEX IF EXISTS public.idx_assets_user_id;

CREATE INDEX IF NOT EXISTS idx_assets_user_id
    ON public.assets USING btree
    (user_id ASC NULLS LAST);


-- Table: public.deployments

-- DROP TABLE IF EXISTS public.deployments;

CREATE TABLE IF NOT EXISTS public.deployments
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    drop_percent numeric(5,2) NOT NULL,
    deployed_amount numeric(18,2) NOT NULL,
    asset_id integer,
    note text COLLATE pg_catalog."default",
    deployed_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT deployments_pkey PRIMARY KEY (id),
    CONSTRAINT deployments_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_deployments_deployed_at

-- DROP INDEX IF EXISTS public.idx_deployments_deployed_at;

CREATE INDEX IF NOT EXISTS idx_deployments_deployed_at
    ON public.deployments USING btree
    (deployed_at ASC NULLS LAST);

-- Index: idx_deployments_user_id

-- DROP INDEX IF EXISTS public.idx_deployments_user_id;

CREATE INDEX IF NOT EXISTS idx_deployments_user_id
    ON public.deployments USING btree
    (user_id ASC NULLS LAST);


-- Table: public.password_resets

-- DROP TABLE IF EXISTS public.password_resets;

CREATE TABLE IF NOT EXISTS public.password_resets
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    otp text COLLATE pg_catalog."default" NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT password_resets_pkey PRIMARY KEY (id),
    CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_password_resets_expires_at

-- DROP INDEX IF EXISTS public.idx_password_resets_expires_at;

CREATE INDEX IF NOT EXISTS idx_password_resets_expires_at
    ON public.password_resets USING btree
    (expires_at ASC NULLS LAST);

-- Index: idx_password_resets_user_id

-- DROP INDEX IF EXISTS public.idx_password_resets_user_id;

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id
    ON public.password_resets USING btree
    (user_id ASC NULLS LAST);


-- Table: public.settings

-- DROP TABLE IF EXISTS public.settings;

CREATE TABLE IF NOT EXISTS public.settings
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    emergency_fund_required numeric(18,2) NOT NULL DEFAULT 0,
    emergency_fund_low_threshold numeric(5,2) NOT NULL DEFAULT 80,
    emergency_fund_critical_threshold numeric(5,2) NOT NULL DEFAULT 50,
    rebalancing_drift_tolerance numeric(5,2) NOT NULL DEFAULT 5,
    crash_drop_levels jsonb NOT NULL DEFAULT '[10, 15, 20, 25]'::jsonb,
    crash_deployment_strategy jsonb NOT NULL DEFAULT '{"10": 25, "15": 50, "20": 75, "25": 100}'::jsonb,
    currency text COLLATE pg_catalog."default" NOT NULL DEFAULT 'LKR'::text,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT settings_pkey PRIMARY KEY (id),
    CONSTRAINT settings_user_id_key UNIQUE (user_id),
    CONSTRAINT settings_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);


-- Table: public.sip_configs

-- DROP TABLE IF EXISTS public.sip_configs;

CREATE TABLE IF NOT EXISTS public.sip_configs
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    monthly_amount numeric(18,2) NOT NULL DEFAULT 0,
    equity_percent numeric(5,2) NOT NULL DEFAULT 60,
    debt_percent numeric(5,2) NOT NULL DEFAULT 20,
    metals_percent numeric(5,2) NOT NULL DEFAULT 10,
    opportunity_percent numeric(5,2) NOT NULL DEFAULT 10,
    asset_allocations jsonb NOT NULL DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sip_configs_pkey PRIMARY KEY (id),
    CONSTRAINT sip_configs_user_id_key UNIQUE (user_id),
    CONSTRAINT sip_configs_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);


-- Table: public.sip_history

-- DROP TABLE IF EXISTS public.sip_history;

CREATE TABLE IF NOT EXISTS public.sip_history
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    month text COLLATE pg_catalog."default" NOT NULL,
    total_amount numeric(18,2) NOT NULL,
    breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
    executed_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT sip_history_pkey PRIMARY KEY (id),
    CONSTRAINT sip_history_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_sip_history_month

-- DROP INDEX IF EXISTS public.idx_sip_history_month;

CREATE INDEX IF NOT EXISTS idx_sip_history_month
    ON public.sip_history USING btree
    (month COLLATE pg_catalog."default" ASC NULLS LAST);

-- Index: idx_sip_history_user_id

-- DROP INDEX IF EXISTS public.idx_sip_history_user_id;

CREATE INDEX IF NOT EXISTS idx_sip_history_user_id
    ON public.sip_history USING btree
    (user_id ASC NULLS LAST);


-- Table: public.transactions

-- DROP TABLE IF EXISTS public.transactions;

CREATE TABLE IF NOT EXISTS public.transactions
(
    id integer GENERATED ALWAYS AS IDENTITY,
    user_id integer NOT NULL,
    type text COLLATE pg_catalog."default" NOT NULL,
    amount numeric(18,2) NOT NULL,
    asset_id integer,
    source_account_id integer,
    destination_account_id integer,
    date text COLLATE pg_catalog."default" NOT NULL,
    tag text COLLATE pg_catalog."default",
    note text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT transactions_pkey PRIMARY KEY (id),
    CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_transactions_date

-- DROP INDEX IF EXISTS public.idx_transactions_date;

CREATE INDEX IF NOT EXISTS idx_transactions_date
    ON public.transactions USING btree
    (date COLLATE pg_catalog."default" ASC NULLS LAST);

-- Index: idx_transactions_user_id

-- DROP INDEX IF EXISTS public.idx_transactions_user_id;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
    ON public.transactions USING btree
    (user_id ASC NULLS LAST);


-- Table: public.valuations

-- DROP TABLE IF EXISTS public.valuations;

CREATE TABLE IF NOT EXISTS public.valuations
(
    id integer GENERATED ALWAYS AS IDENTITY,
    asset_id integer NOT NULL,
    value numeric(18,2) NOT NULL,
    units numeric(18,6),
    nav numeric(18,6),
    price_per_unit numeric(18,6),
    date text COLLATE pg_catalog."default" NOT NULL,
    note text COLLATE pg_catalog."default",
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT valuations_pkey PRIMARY KEY (id),
    CONSTRAINT valuations_asset_id_fkey FOREIGN KEY (asset_id)
        REFERENCES public.assets (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE CASCADE
);

-- Index: idx_valuations_asset_id

-- DROP INDEX IF EXISTS public.idx_valuations_asset_id;

CREATE INDEX IF NOT EXISTS idx_valuations_asset_id
    ON public.valuations USING btree
    (asset_id ASC NULLS LAST);

-- Index: idx_valuations_date

-- DROP INDEX IF EXISTS public.idx_valuations_date;

CREATE INDEX IF NOT EXISTS idx_valuations_date
    ON public.valuations USING btree
    (date COLLATE pg_catalog."default" ASC NULLS LAST);