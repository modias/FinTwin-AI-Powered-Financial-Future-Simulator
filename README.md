# FinTwin — AI-Powered Financial Future Simulator

> Your financial future, before it happens.

Most personal finance tools categorise the past. FinTwin is built to answer a
forward-looking question instead:

**How much can I safely spend today while protecting my minimum bank balance?**

## Repository layout

```text
fintwin/
├── frontend/    Next.js application with the Monte Carlo engine
└── backend/     FastAPI service for the Capital One Nessie sandbox
```

The simulation still runs in the browser from the onboarding profile or the
demo dataset. The backend only fetches Nessie sandbox customers, accounts, and
transactions. It does not replace that profile, and the Nessie API key never
goes to the frontend.

## Running it

```bash
cd fintwin/frontend
npm install
npm run dev
```

Open <http://localhost:3000> and choose **Build My Financial Twin** to answer a
short questionnaire about your income, bills and spending, or **Try with Demo
Data** to explore a seeded example. No API keys, backend or bank connection
required.

See [`fintwin/frontend/README.md`](fintwin/frontend/README.md) for the
simulation model and its assumptions, the onboarding system, the architecture
and the demonstration dataset.

## What it does

A four-step onboarding questionnaire turns your answers into a cash-flow
timeline: balance, paydays, rent, bills and everyday spending. A Monte Carlo
engine, written in TypeScript and run in a Web Worker, simulates 10,000
possible futures from that timeline over 30, 60 or 90 days. Scheduled bills
and income are fixed; everyday spending and unexpected expenses vary.

- **Safe to Spend**: the largest purchase today that still keeps your balance
  above your protected minimum in at least 90%, 95% or 99% of simulated
  futures (your choice).
- **What-if decisions**: test a purchase, a recurring expense, a change in
  income or rent, and see your chance of staying safe before and after, on the
  same simulated futures.
- **Scenario Lab**: compare up to three options side by side.
- **Forecast bands**: the median and the middle 80% of simulated balances for
  each day.

On the demo data with default settings, Alex has a 97.81% chance of staying
above $300 for 90 days and $523.24 safe to spend today; a $600 PlayStation
today drops that to 94.38%, below the 95% target.

Answers are kept only in the browser's `localStorage`, which is fine for a
demo but not a secure store for real financial data. No request leaves the
browser.

> FinTwin uses simulated financial outcomes based on your financial profile and
> modeling assumptions. These results are estimates, not guarantees or
> personalized financial advice.

## Roadmap

| Phase | Scope                                                                    |
| ----- | ------------------------------------------------------------------------ |
| 1     | **Done** — app shell, dashboard, onboarding, typed services              |
| 2     | **Done** — Monte Carlo engine, Safe to Spend, what-ifs, percentile bands |
| 2     | **In progress** — FastAPI backend reads the Nessie sandbox; it does not feed the simulation yet |
| 3+    | Gemini-generated explanations, voice summaries, authentication        |

## License

See [LICENSE](LICENSE).
