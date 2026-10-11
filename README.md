# FinTwin — Your Financial Future, Before It Happens

FinTwin helps you estimate your short-term financial risk and answers one
practical question:

**How much can I safely spend today while still protecting the minimum
balance I want to keep?**

You describe your income, bills and everyday spending, and FinTwin simulates
10,000 possible versions of the next 30, 60 or 90 days. It then tells you how
likely your balance is to stay above your chosen minimum, and how much you
could spend today without dropping below your safety target.

> FinTwin's results are simulated estimates based on your answers and the
> model's assumptions. They are not guarantees or personalized financial advice.

## The Problem

A checking balance shows how much money is in the account. It doesn't show how
much of that money is actually free to spend.

Rent might be due before your next paycheck. A subscription renews next week.
Groceries cost more than usual one month, or the car needs a repair. Most
budgeting tools categorize what you have already spent. FinTwin looks ahead
instead: it puts your upcoming bills, paydays and the normal ups and downs of
spending on a timeline, then measures how often things work out.

## Features

### Four-step financial onboarding
A short questionnaire builds your financial profile:

1. **Income**: your checking balance, take-home pay, pay schedule and any
   one-off payments you expect.
2. **Housing and bills**: rent or mortgage and its due date, plus other
   recurring bills (amount, category and frequency).
3. **Everyday spending**: what a typical month looks like by category, and
   whether to plan for unexpected expenses.
4. **Safety**: the balance you want to protect, how cautious FinTwin should be,
   and how far ahead to look.

Answers save as you go, so a refresh resumes where you left off. A review
screen shows a monthly income-vs-expenses breakdown before you save. If you
just want to look around, **Try with Demo Data** loads a sample profile
("Alex") with several accounts and transaction history.

### User-defined protected minimum balance
You choose the lowest balance you are comfortable with, for example $300. You
can type any amount or pick a preset ($0, $100, $300, $500 or $1,000). Every
safety calculation is measured against this number.

### Monte Carlo simulation with 10,000 possible futures
The simulation engine is written in TypeScript and runs in a Web Worker inside
the browser. Scheduled income and bills land on the same dates in every
simulated future. Everyday spending and, optionally, unexpected expenses vary
randomly from one future to the next.

### Financial safety score and Safe-to-Spend
The Overview dashboard shows:

- **Safe to Spend today**: the largest purchase you could make today while
  still meeting your safety target.
- **Financial safety**: the percentage of simulated futures in which your
  balance never drops below your protected minimum.
- A **forecast chart** showing the median balance and the range covering the
  middle 80% of simulated outcomes.
- Upcoming income and bills, a spending breakdown and recent transactions.

A "How is this calculated?" section lists the inputs the simulation used.

### Future Simulator
Test a decision before you make it. Pick a preset ("$600 PlayStation today",
"Same $600, after next payday", "$45 a month subscription") or describe your
own change:

- a one-time or delayed purchase
- a recurring expense
- an unexpected expense
- an income increase or reduction
- a rent increase or decrease

FinTwin shows your safety score and Safe-to-Spend amount before and after the
change.

### Scenario Lab
Compare up to three decisions side by side. One example is buying a $1,200
laptop today versus after payday versus buying a $700 laptop today. The lab
highlights the option that keeps you safest and says whether it meets your
target. You can overlay each option's forecast on your current plan.

### Financial Insights
- **Simulated risk** (looking ahead): chance of dipping below your minimum,
  the tightest day in the forecast, a bad-case low balance, and the factors
  that shape your risk, such as bill timing, income timing and the range of
  everyday spending.
- **Spending analytics** (looking back, demo profile only): total and average
  daily spend, net cash flow, top category, largest expense, most frequent
  merchant, recurring commitments, weekly spending and a category ranking.

A profile you build yourself has no transaction history, so the history
section explains that instead of showing demo data in its place.

### Google Gemini risk explanations
If the backend is running with a Gemini API key, an **Explain My Risk** button
appears in two places:

- On the Overview dashboard, it explains your current safety score.
- In the Future Simulator's before-and-after results, it explains how a what-if
  moved your score.

Gemini only puts into words results that the simulation already calculated.
It does not run the simulation, and it is told not to give advice. The backend
rejects any reply that contains a dollar amount, percentage or date that wasn't
in the simulation results it was given, or that names one factor as "the
biggest cause" (the simulation doesn't rank causes). It retries once, then
shows an error message instead of an unchecked explanation.

### Capital One Nessie sandbox integration (in progress)
The FastAPI backend can read **sandbox** customers, accounts and transactions
from Capital One's Nessie API, and the API key stays on the server. In
development mode, the Settings page includes a panel that lists sandbox
customers and their checking accounts.

This data is for display only: **it does not feed the simulation yet**, and it
doesn't replace your onboarding profile or the demo dataset.

### Other details
- Settings for protected minimum, forecast horizon (30/60/90 days), safety
  target (90%, 95% or 99%), unexpected expenses on/off, and light/dark/system
  theme. Changes apply right away, and a panel shows their effect.
- A notifications menu that lists income and bills due in the next 7 days.
- Transaction search and category filtering for the demo profile.

## How It Works

### 1. Build a timeline
Your answers become a day-by-day cash-flow timeline for the forecast period.
The examples below use 30 days; you can also choose 60 or 90. The timeline
includes your opening balance, paydays, rent, recurring bills and expected
everyday spending.

### 2. Simulate 10,000 futures
For each simulated future, FinTwin walks through every day in order:

1. add any scheduled income;
2. subtract scheduled bills;
3. subtract that future's randomly drawn everyday spending;
4. subtract any randomly drawn unexpected expenses, if they're turned on;
5. record the closing balance.

Income and bills are identical in every future. Spending varies in two ways:
each future gets its own "higher or lower spending month" factor, plus smaller
random variation on individual purchases. Unexpected expenses use a stated
assumption of about three a year averaging $600. That figure is a modelling
choice, not something known about you.

### 3. Count the safe futures
A simulated future counts as **safe** only if the checking balance stays at or
above your protected minimum **on every day of the forecast**, not just at the
end.

```text
Safety % = (safe simulations / total simulations) × 100
```

For example, if 9,781 of 10,000 futures never drop below $300, your safety
score is 97.81%.

### 4. Compare against your target
The default safety target is **95%**, so at least 9,500 of the 10,000 futures
must stay safe. You can choose 90% (more spending room) or 99% (more margin
for surprises) instead.

### 5. Find the Safe-to-Spend amount
A purchase made today lowers your balance by the same amount on every day of
every future. FinTwin takes each future's lowest balance, sorts them, and finds
the largest amount that still leaves at least 95% of futures above your
minimum. The result is double-checked against the same futures and rounded
down to the cent. If your plan already falls short of 95% before any purchase,
Safe to Spend is $0 and FinTwin says why.

### 6. Test a purchase
A what-if is a set of dated cash changes, for example −$600 today. FinTwin
applies those changes to the **same 10,000 futures** it used for your current
plan, so any difference in the score comes from the decision, not from random
chance.

On the demo profile with default settings (90-day horizon, $300 minimum, 95%
target), Alex has a 97.81% chance of staying above $300 and can safely spend
$523.24 today. A $600 PlayStation bought today lowers the score to 94.38%,
which falls below the 95% target.

More detail on the model and its assumptions is in
[`fintwin/frontend/README.md`](fintwin/frontend/README.md).

## Tech Stack

**Frontend** (`fintwin/frontend`)
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4, shadcn/ui and Radix UI components, Lucide icons
- Recharts for charts
- TanStack Query for data fetching and caching
- Zod for schema validation
- Motion, next-themes and Sonner for animation, theming and notifications
- Web Workers for running the Monte Carlo simulation off the main thread
- Vitest and ESLint

**Backend** (`fintwin/backend`)
- Python, FastAPI, Uvicorn
- Pydantic, httpx, python-dotenv
- Google Gen AI SDK (`google-genai`) for Gemini
- pytest

**External APIs**
- Google Gemini API (risk explanations)
- Capital One Nessie API (sandbox data)

## Getting Started

### Repository layout

```text
fintwin/
├── frontend/    Next.js app, including the Monte Carlo engine
└── backend/     FastAPI service for Gemini explanations and the Nessie sandbox
```

### Frontend

You need Node.js 20 or newer.

```bash
cd fintwin/frontend
npm install
cp .env.example .env.local   # optional; the defaults work
npm run dev
```

Open <http://localhost:3000>, then choose **Build My Financial Twin** or **Try
with Demo Data**. The onboarding, simulation, Safe to Spend, Future Simulator,
Scenario Lab and Insights all work without the backend or any API keys.

Frontend environment variables (`fintwin/frontend/.env.local`):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_DATA_MODE` | Data source. Keep this as `mock`. |
| `NEXT_PUBLIC_API_BASE_URL` | URL of the local backend, default `http://localhost:8000`. |
| `NEXT_PUBLIC_DEMO_REFERENCE_DATE` | Date the demo dataset is anchored to (`YYYY-MM-DD`). |

`NEXT_PUBLIC_*` values are bundled into the browser code, so **never put an API
key in this file**.

Other scripts:

```bash
npm test           # Vitest unit tests
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build
```

### Backend (optional)

The backend is only needed for Gemini explanations and the Nessie sandbox
panel. You need Python 3.10 or newer.

```bash
cd fintwin/backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then add your own keys
uvicorn app.main:app --reload --port 8000
```

Backend environment variables (`fintwin/backend/.env`):

```bash
NESSIE_API_KEY=your_nessie_api_key_here
NESSIE_BASE_URL=https://api.nessieisreal.com
NESSIE_TIMEOUT_SECONDS=10

GEMINI_API_KEY=your_gemini_api_key_here
# GEMINI_MODEL=gemini-3.1-flash-lite   # optional
```

- `backend/.env` is ignored by git. Don't commit it, and don't copy these keys
  into the frontend.
- If a key is missing, the related feature returns a clear "not configured"
  message, and the rest of the app keeps working.
- CORS allows `http://localhost:3000` only.

Useful backend commands:

```bash
pytest                                  # backend tests
python scripts/check_nessie_connection.py   # checks Nessie access without printing the key
```

Main endpoints: `GET /api/health`, `POST /api/ai/explain-risk`,
`POST /api/ai/explain-scenario`, and read-only `GET /api/nessie/...` routes for
customers, accounts and transactions. The Nessie routes are meant for local
development and shouldn't be exposed publicly without authentication.

## AI Usage Disclosure

I used AI tools during the development of FinTwin to help brainstorm and refine
the project idea, troubleshoot errors in the code, and assist with debugging and
development.  I also used Grok to help create the demo video. I reviewed and tested the code throughout the project.

That is separate from the **Google Gemini API, which is a feature inside
FinTwin**. When a user clicks "Explain My Risk", the backend sends the simulation's already-calculated results to Gemini and gets
back a short plain-language explanation. Gemini does not calculate the safety
score, Safe-to-Spend or any forecast. Those come from FinTwin's own Monte Carlo
engine, which runs in the browser.

## Limitations

- **Estimates, not guarantees.** Results depend on your answers and on the
  model's assumptions, such as how much spending varies and how often
  unexpected expenses happen. Real life can differ from every simulated
  future. A 95% target is a goal for the model, not a promise.
- **No real bank connection.** FinTwin doesn't connect to real bank accounts.
  Your profile comes from what you enter during onboarding, or from the demo
  dataset.
- **Nessie is sandbox data only, and it doesn't feed the simulation.** Capital
  One's Nessie API provides test customers and accounts. FinTwin can display
  them in a development-only panel, but they are not used to build forecasts
  yet.
- **Browser storage only.** Profiles and settings are saved in the browser's
  `localStorage`. That's fine for a demo, but it isn't a secure place to store
  real financial data, and there are no user accounts or authentication.
- **Limited history for personal profiles.** Spending analytics and
  transaction history are only available for the demo profile. A profile you
  enter yourself uses default assumptions for how much spending varies.
- **AI explanations need a backend key** and depend on Gemini being available.
  When a reply can't be checked against the simulation results, it isn't
  shown.

## Future Improvements

- **Real banking integrations**: securely connect real accounts so balances,
  bills and transactions update automatically, and connect the Nessie data to
  the simulation as a first step.
- **Better personalization**: user accounts, secure server-side storage, and
  assumptions (such as unexpected expenses) tuned to each person instead of
  fixed defaults.
- **More accurate spending predictions**: learn spending patterns, seasonality
  and recurring charges from transaction history to produce tighter, more
  realistic forecasts.

## License

See [LICENSE](LICENSE).
