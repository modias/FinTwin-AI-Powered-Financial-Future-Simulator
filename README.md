# FinTwin — AI-Powered Financial Future Simulator

> Your financial future, before it happens.

Most personal finance tools categorise the past. FinTwin is built to answer a
forward-looking question instead:

**How much can I safely spend today while protecting my minimum bank balance?**

## Repository layout

```text
fintwin/
└── frontend/    Next.js application — Phase 1, complete and runnable
```

A `fintwin/backend/` directory (FastAPI, Monte Carlo simulation engine, Capital
One Nessie integration) arrives in Phase 2. The frontend already defines the
service interface and Zod schemas that backend will implement.

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
onboarding system, the architecture, the demonstration dataset, and the Phase 2
integration points.

## Phase 1 scope

Phase 1 is the complete frontend. A four-step onboarding questionnaire turns
your answers into the same cash-flow timeline the demo dataset uses, so the
dashboard, forecast and settings are personalised before anything is
simulated. Answers are kept only in the browser's `localStorage`, which is fine
for a demo but not a secure store for real financial data. The Monte Carlo
simulation engine is not built yet.

Where a number would require simulation, the interface says so rather than
inventing one — the Financial Safety card reads "Simulation not yet available",
the forecast is labelled an illustrative projection rather than a Monte Carlo
simulation, and the headline safe-to-spend figure is a transparent subtraction
that the UI shows in full and explicitly declines to describe as a 95%
probability of safety.

## Roadmap

| Phase | Scope                                                                 |
| ----- | --------------------------------------------------------------------- |
| 1     | Frontend foundation — app shell, dashboard, onboarding, typed services |
| 2     | Monte Carlo engine, probabilistic safe-to-spend, percentile bands     |
| 2     | FastAPI backend, Capital One Nessie integration                       |
| 3+    | Gemini-generated explanations, voice summaries, authentication        |

## License

See [LICENSE](LICENSE).
