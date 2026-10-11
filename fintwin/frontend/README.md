# FinTwin — Frontend

> Your financial future, before it happens.

FinTwin is a probabilistic financial decision-making tool. Instead of
categorising the past like a budgeting app, it answers a forward-looking
question:

**How much can I safely spend today while protecting my minimum bank balance?**

This directory is the complete, runnable application, including a
**Monte Carlo simulation engine written in TypeScript** that runs in a Web
Worker in the browser. It needs no backend, no API keys and no bank
connection. The dashboard is driven either by **your own answers** to a short
onboarding questionnaire or by a typed **demonstration dataset**.

> FinTwin uses simulated financial outcomes based on your financial profile and
> modeling assumptions. These results are estimates, not guarantees or
> personalized financial advice.

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

## What works

Everything in the interface is real: on data you type in, or on
demonstration data. The interface says which one you are looking at on every
screen, and labels every figure by where it came from: **user-entered**,
**historical**, **scheduled**, **estimated**, **simulated** or
**hypothetical**.

- The welcome screen at `/`, which leads into onboarding or the demo.
- Financial onboarding: four validated steps, a review screen, editing from
  Settings, resume after refresh, switching between your profile and the demo,
  and reset (see [Onboarding and personal profiles](#onboarding-and-personal-profiles)).
- **Overview**: a simulated Safe-to-Spend amount, the chance of staying above
  your protected minimum, a bad-case low balance, and a forecast chart with
  daily 10th/50th/90th percentile bands at 30, 60 or 90 days.
- **Future Simulator**: describe a purchase or another change and see your
  risk before and after, on the same simulated futures.
- **Scenario Lab**: compare up to three options side by side.
- **Financial Insights**: simulated risk metrics and what drives them, plus
  descriptive analytics from transaction history (demo only).
- **Settings**: protected minimum, safety target, horizon and unexpected
  expenses; every change re-runs the simulation, and no result is shown next to
  inputs it was not computed from.
- Account switching, transaction search and filtering, light (default), dark
  and system themes.

**Deliberately absent:** authentication, payments, and the Nessie / FastAPI /
Gemini integrations. No request leaves the browser.

The rule applied throughout: **never a fabricated result.** No figure is a
placeholder, no chart value is random per render, and nothing in the UI is a
decorative control that looks functional and does nothing.

## The Monte Carlo engine

The engine lives in `src/simulation/`. It is plain TypeScript: no React, no
clock, no network. It runs in a Web Worker (`src/workers/simulation.worker.ts`)
so 10,000 paths never block the page.

### What a path is

The opening balance is the account's balance on the reference date. It
already reflects every past transaction: history is **never** replayed into
it, only used to measure how spending varies. From there each path walks the
horizon day by day, and every day happens in this order:

1. start from the previous closing balance;
2. add scheduled income;
3. subtract scheduled bills;
4. subtract the path's sampled variable spending;
5. subtract the path's sampled unexpected expenses;
6. apply hypothetical scenario changes (what-ifs only);
7. check the protected minimum;
8. record the closing balance.

All money is **integer cents** and all dates are `YYYY-MM-DD`. Every event on
the timeline comes from one expansion of the profile (or demo dataset), so
nothing is counted twice.

**A path is safe only if it never falls below the protected minimum on any
day**, including day 0 after a purchase made today. A path that dips below
and recovers is still unsafe.

```text
safety probability = safe paths / total paths
breach probability = 1 − safety probability
```

### What is fixed and what is random

| On every path | Varies by path |
| ------------- | -------------- |
| Opening balance, income on its dates, scheduled bills (rent, utilities, subscriptions…), expected one-off payments | Everyday spending, unexpected expenses |

Scheduled bills are **not** randomised: a $850 rent payment is $850 on every
path.

**Everyday spending** is split into **essential** (groceries and transport)
and **discretionary** (dining, shopping, entertainment…). Each
spending occurrence is drawn as `expected × L × E`:

- `E` is lognormal with mean 1: week-to-week noise.
- `L` is lognormal with mean 1, drawn **once per path**: the chance that the
  estimate itself is off, which persists for the whole horizon instead of
  averaging out.

So the expected amount is unchanged, spending can never be negative, and
overspending can be large. How much it varies:

| Source | Essential | Discretionary |
| ------ | --------- | ------------- |
| No history (fallback) | 15% week to week, 10% level | 40% week to week, 10% level |
| ≥ 4 weeks and ≥ 6 transactions of history | measured from weekly totals | measured from weekly totals |

Without history, the result carries a **limited information** warning
everywhere it is shown. Measured variation is kept between 5% and 150%.

**Unexpected expenses** (a toggle in Settings) are an assumption, not a fact
about you: Poisson arrivals at about **3 a year**, lognormal costs averaging
**$600** (standard deviation $600), capped at $5,000. When they are on, they
replace the questionnaire's planning allowance rather than adding to it.

All of these live in `src/simulation/assumptions.ts`, and the "How is this
calculated?" panels show the ones used for each result.

### Safe to Spend

Safe to Spend is the **largest purchase today** that keeps the safety
probability at or above your target (90%, 95% or 99%):

1. For each path, take its lowest balance over the horizon.
2. A purchase of `x` today lowers every balance by `x`, so the path stays safe
   exactly when `lowest balance − x ≥ minimum`.
3. At least `ceil(target × paths)` paths must stay safe, so the answer is that
   order statistic of the path minima, minus the minimum, **rounded down to
   the cent** and capped at the current balance.
4. The amount is then **verified on the same paths**; the engine throws rather
   than return an amount that misses the target.

It is never negative and never more than the balance. When your plan misses
the target even without a purchase, the card shows exactly
**Safe to Spend: $0** and: _"Your current financial forecast does not meet your
selected safety target, even without an additional purchase."_

### What-if scenarios

| Type | Effect |
| ---- | ------ |
| One-time purchase | One payment on its date |
| Delayed purchase | One payment on a later date (after today) |
| Recurring expense | Weekly, biweekly or monthly from its start date |
| Unexpected expense | One payment on its date |
| Income increase / reduction | Changes each regular paycheck from its date |
| Rent increase / decrease | Changes each rent or mortgage payment from its date |

Every scenario is evaluated on **the baseline's own paths** (common random
numbers): same spending draws, same emergencies. The difference between
before and after is therefore the decision, not sampling noise, and a change
with no effect gives exactly the baseline result. Comparisons show the
percentage-point change and whether the target is still met.

### Forecast bands

Each day shows the 10th, 50th and 90th percentiles across paths. **The shaded
band is the middle 80% of simulated balances, not a 95% confidence
interval**, and real balances can fall outside it.

### Reproducibility and freshness

- A seeded PRNG (sfc32, seeded through splitmix32) with separate streams for
  spending and emergencies per path. The same inputs always give the same
  numbers.
- Every result carries a fingerprint of its exact input: every profile answer,
  the account, minimum, target, horizon and the unexpected-expense setting.
  Queries are keyed by it, so changing anything starts a new simulation and
  nothing stale is shown.
- Changing only the minimum or the target reuses the cached paths (an LRU of
  three path sets); anything else simulates again.
- The client runs one request at a time and drops superseded ones. Where Web
  Workers are unavailable, the same handler runs on the main thread.
- Probabilities are shown to one decimal and never rounded to 100% or 0%
  unless exact (`>99.9%`, `<0.1%`).

A 10,000-path, 90-day run takes well under 100 ms; comparing scenarios on
cached paths takes a few milliseconds.

### Demo headline figures

With the default settings (minimum $300, 95% target, 90 days, unexpected
expenses on), Alex's primary account gives:

| Figure | Value |
| ------ | ----- |
| Chance of staying above $300 | 97.81% |
| Safe to Spend today | $523.24 |
| After a $600 PlayStation today | 94.38%, below the 95% target |

A test (`data/__tests__/mock-data.test.ts`) asserts these, so the README cannot
drift from the engine.

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
written in. Both are expanded by the same `expandCashFlowEvents` and fed to
the same simulation (`src/simulation/timeline.ts`); there is no second
forecasting system.

- Rent and recurring bills become **scheduled** bills on the days you chose.
- Everyday spending becomes two weekly **estimated** amounts, essential and
  discretionary, which the simulation varies separately. Unexpected expenses
  (when included) add a planning allowance of about 3 surprises a year
  averaging $600; the simulation replaces that allowance with randomly drawn
  emergencies rather than counting both.
- One-time bills and expected irregular payments become one-off events.

### No history, no invented history

A personal profile has no transactions, and Alex's mock transactions are
**never** mixed in. Instead:

- the spending breakdown is built from your estimates and labelled that way;
- Transaction History and Financial Insights explain that there is no history
  and link to editing the profile;
- the simulation uses **documented fallback assumptions** for how much
  spending varies (`FALLBACK_SPENDING_VARIATION` in
  `src/simulation/assumptions.ts`) rather than pretending to have learned
  them, and shows a limited-information warning.

### Stale results

Every dataset has a key. For a profile it includes a fingerprint of every
answer that affects the forecast, and every query key starts with it, so
editing an answer discards cached figures instead of showing them for the
wrong inputs. Simulation results go further: each one carries the fingerprint
of its full input, including preferences, and a result is only displayed
next to the input it was computed from.

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
│   │   ├── simulator/        Future Simulator: one what-if, before and after
│   │   ├── scenarios/        Scenario Lab: up to 3 options side by side
│   │   ├── insights/         Simulated risk and descriptive analytics
│   │   ├── transactions/     Searchable, filterable history
│   │   └── settings/         Financial profile, preferences, reset
│   ├── layout.tsx            Fonts, metadata, providers
│   ├── not-found.tsx         Catches unmatched URLs
│   └── globals.css           Design tokens and theme
├── components/
│   ├── layout/               Sidebar, header, mobile drawer, profile gate
│   ├── onboarding/           Wizard, the four steps, bill editor, review
│   ├── dashboard/            One component per dashboard section
│   ├── simulation/           Percentile chart, what-if form, before/after,
│   │                         risk card, model inputs and warnings
│   ├── providers/            Theme, TanStack Query, workspace state
│   ├── shared/               Page header, metric card, source labels,
│   │                         disclaimer, empty states, skeletons
│   └── ui/                   shadcn/ui primitives
├── data/                     Typed mock dataset and the demo profile
├── hooks/                    Query bindings (data and simulation), today's date
├── lib/
│   ├── onboarding/           Draft, per-step validation, bill list rules
│   ├── profile/              Profile schemas, monthly normalisation,
│   │                         profile → canonical timeline
│   ├── workspace-store.ts    Versioned localStorage store
│   └── …                     calculations, dates, money, formatters, schemas
├── simulation/               The Monte Carlo engine (pure TypeScript)
│   ├── timeline.ts           Canonical timeline → engine input (cents, days)
│   ├── assumptions.ts        Fallbacks, emergency model, history calibration
│   ├── random.ts             Seeded PRNG and per-path streams
│   ├── distributions.ts      Lognormal and Poisson sampling
│   ├── cashflow.ts           The day-by-day path walk
│   ├── percentiles.ts        Daily p10 / p50 / p90
│   ├── optimizer.ts          Safe to Spend, verified on the same paths
│   ├── scenarios.ts          What-if validation and cash flows
│   ├── engine.ts             Metrics, risk drivers, path cache, runtime
│   ├── schemas.ts            Zod validation of inputs and scenarios
│   └── handler.ts, protocol.ts   Typed worker messages
├── workers/                  The simulation Web Worker
├── services/                 FinancialService interface and dataset-backed
│                             implementation; simulation-service (worker client)
└── types/                    Domain model and profile types
```

### Layering

Presentation, data and business logic are kept apart:

- **`lib/calculations.ts`** and **`simulation/`** are pure. No React, no
  network, no clock — every function is a deterministic transform of its
  inputs (the simulation's randomness comes from a seed), which is what makes
  the results reproducible and the tests meaningful.
- **`services/`** owns data access behind the `FinancialService` interface,
  and the simulation worker behind `simulation-service`.
- **`hooks/use-financial-data.ts`** and **`hooks/use-simulation.ts`** own the
  query keys and caching. Components never call a service directly.
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
- **The simulation works in integer cents and day indices.** Day 0 is the
  reference date; the balance already reflects it, so day-0 events are only
  what-ifs made today.

## Tests

`npm test` runs the Vitest suite (197 tests). The engine's tests are in
`simulation/__tests__/engine.test.ts`, one `describe` block per requirement:

| # | Requirement | # | Requirement |
| - | ----------- | - | ----------- |
| 1 | Same seed, same results | 11 | Raising the minimum never raises Safe to Spend |
| 2 | Income on its exact dates | 12 | Raising the target never raises Safe to Spend |
| 3 | Rent and bills on their due dates | 13 | Baseline below target → $0 and the exact warning |
| 4 | No double counting | 14 | Safe to Spend meets the target on the same paths |
| 5 | Short months (31st, February) | 15 | Common random numbers across scenarios |
| 6 | No negative spending | 16 | Delayed purchases apply from their date only |
| 7 | Purchases today checked on day 0 | 17 | Percentiles are correct and ordered |
| 8 | Temporary breaches fail a path | 18 | Fallback assumptions and the limited-information warning |
| 9 | Safety probability matches a brute-force recount | 19 | Any input change invalidates results |
| 10 | Bigger purchases never improve safety | 20 | A hand-computed example, to the cent |

The rest cover the data and the onboarding system at the logic level:

| File | Covers |
| ---- | ------ |
| `lib/__tests__/money.test.ts` | Currency text → integer cents, rejection of invalid input |
| `lib/profile/__tests__/normalize.test.ts` | Weekly → monthly normalisation, bill and income averages, the income-vs-expenses summary |
| `lib/profile/__tests__/timeline.test.ts` | Weekly, biweekly and twice-monthly paychecks; bills on the 29th/30th/31st; zero income and zero rent; rent counted once; estimated spending; no mock data in personal profiles; edited answers reaching the dashboard; estimate-based spending without history |
| `lib/onboarding/__tests__/bills.test.ts` | Adding, editing and removing bills; duplicate and rent prevention; due-date limits |
| `lib/onboarding/__tests__/validation.test.ts` | Required answers per step, payday rules, completion into a valid profile |
| `lib/__tests__/workspace-store.test.ts` | Navigation and completion, persistence and resume, demo switching, reset, corrupt storage |
| `lib/__tests__/calculations.test.ts`, `dates.test.ts` | Event expansion, windows, spending summaries, calendar arithmetic |
| `data/__tests__/mock-data.test.ts` | Dataset invariants and the demo headline figures |
| `data/__tests__/demo-profile.test.ts` | The demo answers agree with the seeded dataset |

## Prepared for the FastAPI backend

`src/services/financial-service.ts` defines the interface the backend will
implement:

```ts
getUserProfile()              getBills(accountId)
getAccounts()                 getIncomeSources(accountId)
getAccount(accountId)         getUpcomingCashFlowEvents(request)
getTransactions(query)        getFinancialSummary(request)
getSpendingSummary(request)
```

The simulation stays in the browser: it needs only the timeline those
methods return, so a backend changes where the data comes from, not how it is
simulated.

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
| 1     | **Done** — app shell, dashboard, onboarding, typed services              |
| 2     | **Done** — Monte Carlo engine, Safe to Spend, what-ifs, percentile bands |
| 2     | FastAPI backend (`backend/`), Capital One Nessie integration             |
| 3+    | Gemini-generated explanations, voice summaries, authentication           |
