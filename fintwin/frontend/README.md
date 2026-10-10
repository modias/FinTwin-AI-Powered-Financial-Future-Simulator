# FinTwin — Frontend (Phase 1)

> Your financial future, before it happens.

FinTwin is a probabilistic financial decision-making tool. Instead of
categorising the past like a budgeting app, it answers a forward-looking
question:

**How much can I safely spend today while protecting my minimum bank balance?**

This directory contains **Phase 1**: the complete, runnable frontend. It runs
with no backend, no API keys and no bank connection. The dashboard is driven
either by **your own answers** to a short onboarding questionnaire or by a
typed **demonstration dataset**.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The welcome screen offers two ways in:

- **Build My Financial Twin** opens the four-step questionnaire at
  `/onboarding`, then a review screen at `/onboarding/review`. Creating the
  twin opens the dashboard built from your answers.
- **Try with Demo Data** opens the dashboard at `/overview` with the seeded
  demo profile (Alex Morgan).

Returning visitors get **Continue to dashboard**, or **Resume setup** if they
left the questionnaire part-way.

No environment file is required — the defaults in `src/lib/constants.ts` match
`.env.example`. Copy it if you want to change them:

```bash
cp .env.example .env.local
```

### Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Development server on port 3000               |
| `npm run build`     | Production build                              |
| `npm start`         | Serve the production build                    |
| `npm test`          | Unit tests (Vitest)                           |
| `npm run typecheck` | `tsc --noEmit`                                |
| `npm run lint`      | ESLint                                        |

## What is real and what is a placeholder

Phase 1 is a real application on data you type in or on demonstration data.
The distinction matters, so the interface states which one you are looking at
everywhere rather than burying it here.

**Fully working**

- The welcome screen at `/`, which leads into onboarding or the demo.
- Financial onboarding: four validated steps, a review screen, editing from
  Settings, resume after refresh, switching between your profile and the demo,
  and reset (see [Onboarding and personal profiles](#onboarding-and-personal-profiles)).
- Sidebar and mobile drawer navigation; every link resolves.
- Account switching, which rescopes the summary, forecast, events, spending
  breakdown and transaction list together.
- Forecast horizon switching (30/60/90), interactive chart tooltips, the
  spending donut and the insights charts.
- Transaction search and category filtering.
- Settings, persisted to `localStorage`, applied to the dashboard immediately.
- Light (default), dark and system themes.

**Deliberately absent**

- **The Monte Carlo engine.** The Financial Safety card reads
  _"Simulation not yet available"_ instead of showing a probability, and the
  Future Simulator and Scenario Lab pages are previews with inert inputs and no
  results.
- **A probabilistic safe-to-spend amount.** Phase 1 shows a transparent
  subtraction, labelled as an illustrative estimate (see below).
- **Percentile bands on the forecast.** One deterministic path has no
  distribution to draw.
- Authentication, payments, and the Nessie / FastAPI / Gemini integrations.

The rule applied throughout: **show the shape of what is coming, never a
fabricated result.** Nothing in the UI is a decorative control that looks
functional and does nothing.

## The illustrative safe-to-spend estimate

The headline figure on the Overview dashboard comes from
`src/services/safe-to-spend.ts`:

```text
estimate = current balance
         − scheduled bills in the next 30 days
         − estimated spending in the next 30 days
         − minimum protected balance
```

For a personal profile, "estimated spending" is the everyday spending and the
unexpected-expense allowance from the questionnaire. For the demo it is the
dataset's estimated groceries and fuel.

clamped to a minimum of `$0`.

With the default settings and the primary demo account this evaluates to:

```text
$2,143.00  current balance
− $1,126.98  scheduled bills   (utilities, internet, Netflix, gym, rent, Spotify, phone)
−   $520.00  estimated spending (groceries ×2, fuel ×2)
−   $300.00  protected minimum balance
= $196.02
```

Two deliberate choices make it conservative:

- **Upcoming income inside the window is ignored.** The estimate never spends
  money that has not arrived.
- **The result is clamped at zero**, because a negative "safe to spend" is not a
  spending instruction. The card explains the clamp and shows the raw value when
  it applies.

This is arithmetic, not inference. It does **not** carry a 95% probability of
staying above the protected balance, and the UI says so in the expandable
_"How is this calculated?"_ panel. The `Target confidence` setting is stored for
Phase 2 and is marked in the interface as a future simulation preference that
affects nothing today.

**Phase 2 swap point:** replacing this module with the optimiser touches one
file. Callers depend only on `estimateSafeToSpend()` and the
`SafeToSpendEstimate` shape.

## Onboarding and personal profiles

FinTwin is personalised before it forecasts anything. The questionnaire takes
two to three minutes and never asks for bank logins, account numbers or
passwords.

| Step | Asks for |
| ---- | -------- |
| 1. Income & balance | Checking balance; take-home pay per paycheck; pay schedule (weekly, every two weeks, twice a month on two chosen days, monthly, irregular with optional expected payments, or no regular income); the next payday for predictable schedules |
| 2. Housing & bills | Rent or mortgage and its due day (or "I don't pay rent or mortgage"); a list of other recurring bills you can add, edit and remove |
| 3. Everyday spending | Seven categories entered per week or per month, with a live monthly total; whether to plan for unexpected expenses |
| 4. Financial safety | Balance to protect ($100 / $300 / $500 / custom); caution level (90 / 95 / 99%); forecast horizon (30 / 60 / 90 days) |

Each step validates before Continue moves on, and errors appear only after the
first attempt. Every answer is saved as it is typed, so a refresh or a later
visit resumes in place. The review screen re-validates everything (a payday
saved yesterday may have passed), compares monthly income with monthly
expenses, and shows a neutral note, not a blocker, when expenses are higher.

### Rules the questionnaire enforces

- **Paydays are never guessed.** The next payday must be after today and within
  one pay cycle (7, 14 or 31 days). Twice-monthly pay asks for both days.
  Irregular income counts only the payments you list.
- **Nothing is counted twice.** Rent has its own question, and a bill named
  like rent or a mortgage is rejected with an explanation. Bill names are
  de-duplicated ignoring case, spacing and punctuation. Everyday spending is
  asked for separately from bills.
- **Short months are handled.** A bill due on the 29th, 30th or 31st falls on
  the last day of shorter months and returns to its day afterwards.
- **Amounts are integer cents.** Typed amounts are parsed with string
  arithmetic (`src/lib/money.ts`), so `0.29` is exactly 29 cents.

### One canonical timeline

A saved profile is converted by `src/lib/profile/timeline.ts` into exactly the
same `Bill`, `IncomeSource` and `CashFlowEvent` records the demo dataset is
written in. Both are expanded by the same `expandCashFlowEvents` and projected
by the same `buildForecast` and `estimateSafeToSpend`; there is no second
forecasting system.

- Rent and recurring bills become **scheduled** bills on the days you chose.
- Everyday spending becomes one weekly **estimated** amount, and unexpected
  expenses (when included) a second one. The allowance assumes about 3
  surprises a year averaging $600, roughly $150 a month, and the questionnaire
  says so.
- One-time bills and expected irregular payments become one-off events.

### No history, no invented history

A personal profile has no transactions, and Alex's mock transactions are
**never** mixed in. Instead:

- the spending breakdown is built from your estimates and labelled that way;
- Transaction History and Financial Insights explain that there is no history
  and link to editing the profile;
- the simulation config declares **fallback assumptions** for volatility
  (`FALLBACK_VOLATILITY` in `src/lib/constants.ts`) rather than pretending to
  have learned them.

### Stale results

Every dataset has a key. For a profile it includes a fingerprint of every
answer that affects the forecast, and every query key starts with it, so
editing an answer discards cached figures instead of showing them for the
wrong inputs. The Monte Carlo seam (`src/services/simulation.ts`) goes further:
each `SimulationConfig` carries a fingerprint of all its inputs, including
preferences, and `isSimulationResultCurrent` rejects any result computed from
different ones.

### Storage and privacy

Everything is kept in this browser's `localStorage` under versioned keys:

| Key | Holds |
| --- | ----- |
| `fintwin.profiles.v1` | The personal profile, the demo profile, and which one is active |
| `fintwin.onboarding-draft.v1` | A questionnaire in progress |
| `fintwin.workspace.v2` | The selected account |
| `fintwin.theme.v1` | Light, dark or system |

Every value is validated with Zod when read. Corrupt or outdated data is
discarded, and the app falls back to onboarding rather than crashing. A failed
write (private browsing) keeps working in memory for the session. Only
questionnaire answers are stored: no credentials and no API keys.
**`localStorage` is suitable for this demonstration only; it is not a secure
store for real financial data**, and the welcome screen, the questionnaire and
Settings all say so.

### Demo data and switching

**Try with Demo Data** activates a demo profile whose dashboard is the full
seeded dataset (both accounts, all transactions). Its questionnaire answers
mirror Alex's main checking account, and a test keeps them in agreement.
Settings can switch between the demo and your profile without losing either,
edit the active profile (editing the demo answers creates your own profile and
leaves the demo untouched), or reset onboarding entirely.

Routes inside the dashboard sit behind a gate: with no active profile they
send you to the welcome screen, which never redirects, so there is no redirect
loop. Server and first client render are identical, so there are no hydration
mismatches.

## The demonstration dataset

### Fixed reference date

Every demo date derives from a single anchor,
`DEMO_REFERENCE_DATE` (`2026-10-12`, overridable via
`NEXT_PUBLIC_DEMO_REFERENCE_DATE`). A personal profile is anchored the same way,
on the day you entered your balance. A fixed anchor rather than `new Date()`:

- keeps the forecast, the events timeline and the transaction history
  consistent with each other,
- makes every figure reproducible in tests and screenshots,
- and avoids server/client clock drift during hydration.

Transactions are dated strictly **before** the anchor; forecasts and upcoming
events run **forward** from it, so history and projection never overlap. The
only thing read from the real clock is the greeting
(`useGreeting`), which resolves after mount for exactly this reason.

### Contents

- **2 checking accounts** with different balances and genuinely different
  cash-flow rhythms — a salaried account (`$2,143.00`, biweekly paycheck) and a
  freelance account (`$4,860.25`, monthly retainer plus invoices). Switching
  accounts changes every derived figure.
- **55 transactions** across both accounts, spanning early September to the day
  before the anchor, using recognisable merchants.
- **Recurring bills and income sources**, each carrying an `anchorDate` plus a
  cadence. Future occurrences are *derived*, never hardcoded, which is what
  keeps the dates sensible at any horizon.
- **One-off events** (car registration, holiday gifts, quarterly taxes) placed
  beyond the 30-day window on purpose: the 30-day forecast shows the recurring
  rhythm, and the 60- and 90-day views reveal the lumpy events that change the
  shape of the projection.

### Internal consistency, enforced by tests

`src/data/__tests__/mock-data.test.ts` asserts the invariants that keep the
screens from quietly contradicting each other:

- every record validates against its Zod schema,
- every debit uses one of the seven spending categories, so the donut total can
  never disagree with the transaction table,
- every scheduled bill or income source anchored inside the history window has
  a matching transaction on that date for that amount,
- no transaction is dated on or after the reference date,
- and the headline figures quoted in this README still hold.

Editing the dataset without updating the documentation fails the suite.

## Architecture

```text
src/
├── app/                      Routes (App Router)
│   ├── page.tsx              Welcome screen — build a twin or try the demo
│   ├── onboarding/           Questionnaire and review (no sidebar)
│   ├── (app)/                Everything inside the product
│   │   ├── layout.tsx        Profile gate + sidebar and header shell
│   │   ├── overview/         Overview dashboard
│   │   ├── simulator/        Future Simulator preview (Phase 2)
│   │   ├── scenarios/        Scenario Lab preview (Phase 2)
│   │   ├── insights/         Descriptive analytics
│   │   ├── transactions/     Searchable, filterable history
│   │   └── settings/         Financial profile, preferences, reset
│   ├── layout.tsx            Fonts, metadata, providers
│   ├── not-found.tsx         Catches unmatched URLs
│   └── globals.css           Design tokens and theme
├── components/
│   ├── layout/               Sidebar, header, mobile drawer, profile gate
│   ├── onboarding/           Wizard, the four steps, bill editor, review
│   ├── dashboard/            One component per dashboard section
│   ├── providers/            Theme, TanStack Query, workspace state
│   ├── shared/               Page header, metric card, empty states, skeletons
│   └── ui/                   shadcn/ui primitives
├── data/                     Typed mock dataset and the demo profile
├── hooks/                    Query bindings, today's date, simulation config
├── lib/
│   ├── onboarding/           Draft, per-step validation, bill list rules
│   ├── profile/              Profile schemas, monthly normalisation,
│   │                         profile → canonical timeline
│   ├── workspace-store.ts    Versioned localStorage store
│   └── …                     calculations, dates, money, formatters, schemas
├── services/                 FinancialService interface, dataset-backed
│                             implementation, simulation seam
└── types/                    Domain model and profile types
```

### Layering

Presentation, data and business logic are kept apart:

- **`lib/calculations.ts`** is pure. No React, no network, no clock — every
  function is a deterministic transform of its inputs, which is what makes the
  forecast reproducible and the tests meaningful.
- **`services/`** owns data access behind the `FinancialService` interface.
- **`hooks/use-financial-data.ts`** owns the query keys and caching. Components
  never call a service directly.
- **`components/`** render what they are given.
- The **`(app)` route group** carries the sidebar shell in its own layout, so
  the welcome screen and the 404 page get the providers and the theme without
  any navigation chrome. No component has to ask which route it is on.

### Domain conventions

- **Money** in the domain model is always a positive number of dollars.
  Direction is carried by a discriminator (`type` on transactions, `direction`
  on cash-flow events), so nothing has to guess whether a value was already
  signed. Saved profiles store **integer cents**; `profileToDataset` is the one
  place they become dollars.
- **Dates** are plain `YYYY-MM-DD` calendar days, parsed and formatted in UTC so
  a bill due on the 1st is the 1st in every timezone.
- **Forward windows** all share one convention: the day after the reference date
  through *N* days later (`forwardWindow()`).
- Payloads that could be mistaken for computed results carry a `method` field
  (`"illustrative-placeholder"`, `"deterministic-illustrative"`) so the UI can
  label them honestly.

## Tests

`npm test` runs the Vitest suite. Beyond the dataset invariants above, it
covers the onboarding system end to end at the logic level:

| File | Covers |
| ---- | ------ |
| `lib/__tests__/money.test.ts` | Currency text → integer cents, rejection of invalid input |
| `lib/profile/__tests__/normalize.test.ts` | Weekly → monthly normalisation, bill and income averages, the income-vs-expenses summary |
| `lib/profile/__tests__/timeline.test.ts` | Weekly, biweekly and twice-monthly paychecks; bills on the 29th/30th/31st; zero income and zero rent; rent counted once; estimated spending; no mock data in personal profiles; edited answers reaching the dashboard; estimate-based spending without history |
| `lib/onboarding/__tests__/bills.test.ts` | Adding, editing and removing bills; duplicate and rent prevention; due-date limits |
| `lib/onboarding/__tests__/validation.test.ts` | Required answers per step, payday rules, completion into a valid profile |
| `lib/__tests__/workspace-store.test.ts` | Navigation and completion, persistence and resume, demo switching, reset, corrupt storage |
| `services/__tests__/simulation.test.ts` | Stale-result invalidation and fallback volatility for profiles without history |
| `data/__tests__/demo-profile.test.ts` | The demo answers agree with the seeded dataset |

## Prepared for the FastAPI backend

`src/services/financial-service.ts` defines the interface the backend will
implement:

```ts
getUserProfile()              getBills(accountId)
getAccounts()                 getIncomeSources(accountId)
getAccount(accountId)         getUpcomingCashFlowEvents(request)
getTransactions(query)        getForecast(request)
getFinancialSummary(request)  getSpendingSummary(request)
```

Three decisions make the swap a configuration change rather than a refactor:

1. **Every method is async and parameter-driven.** Even where the mock could
   read a module-scope constant, requests carry `accountId`, `referenceDate`,
   `protectedBalance` and the window — the same arguments an HTTP endpoint
   needs. No call site changes shape.
2. **Zod schemas already exist** for every payload (`src/lib/schemas.ts`), each
   checked against the hand-written types with `satisfies`. The mock service
   validates its own output in development, so the dataset cannot drift away
   from the contract the real API has to meet.
3. **`NEXT_PUBLIC_DATA_MODE` selects the implementation.** `api` currently
   throws a clear error rather than falling back silently, so a misconfigured
   environment is obvious instead of looking like working software backed by
   fake numbers.

No API keys are referenced in frontend code. Nessie, Gemini and ElevenLabs
credentials belong in the backend when it exists; only `NEXT_PUBLIC_*` values —
which are embedded in the browser bundle — are read here.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · shadcn/ui · Radix UI · Lucide · Recharts 3 ·
Motion for React · TanStack Query v5 · Zod 4 · Vitest

Cache Components and Partial Prefetching are enabled. The dashboard is
client-rendered on purpose — it is an interactive tool over data saved in the
browser — so each route prerenders a static shell and the interactive content
hydrates over it. Pages inside `(app)` depend on that saved profile, so they
set `export const instant = false` to opt out of instant-navigation validation.

## Design

Both palettes are built on the same CSS custom properties, so charts and
components follow the active theme instead of hardcoding either one. Light is
the default and is applied to `:root`; `.dark` overrides it.

| Token              | Light (default) | Dark      |
| ------------------ | --------------- | --------- |
| Primary background | `#F6F7FB`       | `#080D19` |
| Sidebar background | `#FFFFFF`       | `#0B1220` |
| Card background    | `#FFFFFF`       | `#111827` |
| Primary text       | `#0B1220`       | `#F9FAFB` |
| Secondary text     | `#5A6B85`       | `#94A3B8` |
| Success            | `#047857`       | `#10B981` |
| Warning            | `#B45309`       | `#F59E0B` |
| Risk               | `#DC2626`       | `#F87171` |
| Accent             | `#4F46E5`       | `#6366F1` |

The dark column is the original brand palette. Light-theme accents are darkened
so chart series and status colours keep their contrast on white.

Typography is Geist and Geist Mono. Currency figures use tabular numerals so
values do not shift as they change.

## Roadmap

| Phase | Scope                                                                    |
| ----- | ------------------------------------------------------------------------ |
| 1     | **This frontend** — app shell, dashboard, onboarding, typed services     |
| 2     | Monte Carlo engine, probabilistic safe-to-spend, percentile bands        |
| 2     | FastAPI backend (`backend/`), Capital One Nessie integration             |
| 3+    | Gemini-generated explanations, voice summaries, authentication           |
