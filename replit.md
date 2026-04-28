# Personal Investment Management System (PIMS)

## Overview

A professional full-stack financial portfolio management application built for Sri Lankan individual investors. Tracks mutual funds (equity/debt), stocks, gold, silver, and cash accounts. Fully configurable — no hardcoded asset names.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Charts**: Recharts
- **Routing**: Wouter
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

- **Authentication**: Register, Login, Forgot Password (OTP), Reset Password, Logout
- **Dashboard**: Net worth, asset allocation pie chart, portfolio growth chart, emergency fund tracker, alerts
- **Portfolio**: Dynamic asset management (Equity Funds, Debt Funds, Metals, Cash) — CRUD
- **Accounts**: Bank accounts, money market, cash tagging (emergency/opportunity/free) — CRUD
- **Transactions**: Full ledger with types (deposit, withdrawal, transfer, invest, redeem, SIP) — CRUD
- **Valuation Engine**: Add/edit/delete valuation snapshots per asset
- **Rebalancing**: Target vs actual drift analysis with suggestions
- **SIP Planner**: Monthly SIP with category % sliders, sub-asset allocation, history tracking
- **Opportunity System**: Market crash deployment strategy with configurable drop levels
- **Performance Analytics**: CAGR, growth charts, category comparison, drawdown
- **Settings**: Emergency fund, rebalancing tolerance, crash levels, deployment strategy — all configurable

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/scripts run seed-defaults` — backfill default settings/SIP config for existing users

## Default User Settings

New users are auto-provisioned (in `auth.ts /register`) with sensible defaults from `artifacts/api-server/src/lib/defaults.ts`:

- `emergencyFundRequired`: 500,000 LKR
- `emergencyFundLowThreshold`: 80%
- `emergencyFundCriticalThreshold`: 50%
- `rebalancingDriftTolerance`: 5%
- `crashDropLevels`: [10, 15, 20, 25]
- `crashDeploymentStrategy`: { 10: 25, 15: 50, 20: 75, 25: 100 }
- `currency`: LKR
- SIP allocation: 60% equity / 20% debt / 10% metals / 10% opportunity

Run `pnpm --filter @workspace/scripts run seed-defaults` to backfill users created before this defaults system was added.

## Architecture

- `artifacts/pims/` — React + Vite frontend (served at `/`)
- `artifacts/api-server/` — Express API server (served at `/api`)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/` — Generated React Query hooks
- `lib/api-zod/` — Generated Zod validation schemas
- `lib/db/` — Drizzle ORM client + schema

## DB Schema

- `users` — Multi-user auth with bcrypt password hashing
- `password_resets` — OTP-based password reset with expiry
- `assets` — All investment assets (equity_fund, debt_fund, metal, cash categories)
- `valuations` — Historical value snapshots per asset
- `accounts` — Bank/cash accounts tagged as emergency/opportunity/free
- `transactions` — Full transaction ledger
- `sip_configs` — Per-user SIP configuration with asset allocations
- `sip_history` — SIP execution history
- `settings` — Per-user configurable settings
- `deployments` — Market crash deployment history

## Test Account

- Email: test@pims.lk
- Password: test1234
