/**
 * Core domain model for FinTwin.
 *
 * These types describe the shapes the UI renders. They are intentionally
 * transport-agnostic: in Phase 1 they are satisfied by the mock service, and in
 * later phases the same shapes will be returned by the FastAPI backend.
 *
 * Money is always represented as a positive number of dollars. Direction is
 * carried by a discriminator (`type` on transactions, `direction` on cash-flow
 * events) rather than by the sign, so that no part of the UI has to guess
 * whether a value was already signed.
 */

export const SPENDING_CATEGORIES = [
  "Housing",
  "Food",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Subscriptions",
] as const;

/** Expense categories shown in the transaction-based spending breakdown. */
export type SpendingCategory = (typeof SPENDING_CATEGORIES)[number];

/**
 * Every category an event, bill or transaction can carry. The categories after
 * the seven spending categories exist for obligations a personal profile can
 * describe (insurance, loan repayments) that the demo transaction history
 * never contains.
 */
export const TRANSACTION_CATEGORIES = [
  ...SPENDING_CATEGORIES,
  "Healthcare",
  "Insurance",
  "Debt",
  "Personal Care",
  "Other",
  "Income",
  "Transfer",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export type AccountType = "checking" | "savings";

/** `debit` leaves the account, `credit` arrives in the account. */
export type TransactionType = "debit" | "credit";

/** How often a recurring bill or income source repeats. */
export type Cadence = "weekly" | "biweekly" | "monthly";

/**
 * `scheduled` events have a known amount and date (rent, a subscription).
 * `estimated` events are modelled from habitual spending (groceries, fuel).
 */
export type EventConfidence = "scheduled" | "estimated";

export type CashFlowDirection = "income" | "expense";

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  /**
   * Last four digits, displayed as `•••• 4821`. `null` for an account the user
   * described during onboarding, which never asks for account numbers.
   */
  mask: string | null;
  currentBalance: number;
  currency: "USD";
  /** Only one account is the user's primary demo account. */
  isPrimary: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  merchant: string;
  category: TransactionCategory;
  /** Always positive; see `type` for direction. */
  amount: number;
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  type: TransactionType;
  description: string;
}

export interface Bill {
  id: string;
  accountId: string;
  name: string;
  category: TransactionCategory;
  amount: number;
  cadence: Cadence;
  /**
   * A known past or present occurrence. Future occurrences are derived from
   * this anchor plus the cadence, which keeps generated dates deterministic.
   */
  anchorDate: string;
  confidence: EventConfidence;
  autoPay: boolean;
}

export interface IncomeSource {
  id: string;
  accountId: string;
  name: string;
  payer: string;
  amount: number;
  cadence: Cadence;
  anchorDate: string;
  confidence: EventConfidence;
}

/**
 * A single projected movement of money. Generated from bills and income
 * sources, and the only input the forecast walk consumes.
 */
export interface CashFlowEvent {
  id: string;
  accountId: string;
  name: string;
  category: TransactionCategory;
  amount: number;
  date: string;
  direction: CashFlowDirection;
  confidence: EventConfidence;
  /** The `Bill` or `IncomeSource` this occurrence was generated from. */
  sourceId: string;
}

export interface ForecastPoint {
  /** ISO calendar date, `YYYY-MM-DD`. */
  date: string;
  /** Days from the forecast start; `0` is the reference date. */
  dayIndex: number;
  projectedBalance: number;
  /** Income arriving on this date, `0` when none. */
  income: number;
  /** Scheduled bills due on this date, `0` when none. */
  bills: number;
  /** Estimated everyday spending on this date, `0` when none. */
  estimatedSpending: number;
  /** Repeated on every point so the chart can draw a flat threshold line. */
  protectedBalance: number;
}

export interface ForecastSeries {
  accountId: string;
  horizonDays: number;
  /** Date the walk starts from, `YYYY-MM-DD`. */
  startDate: string;
  startingBalance: number;
  protectedBalance: number;
  points: ForecastPoint[];
  endingBalance: number;
  lowestProjectedBalance: number;
  lowestProjectedBalanceDate: string;
  /** Number of days the projection sits below the protected balance. */
  daysBelowProtectedBalance: number;
  /**
   * Phase 1 forecasts are a deterministic walk over mock events, not a
   * probabilistic simulation. Carried on the payload so the UI can label it.
   */
  method: "deterministic-illustrative";
}

export interface SafeToSpendLine {
  label: string;
  description: string;
  amount: number;
  /** `add` lines increase the estimate, `subtract` lines reduce it. */
  effect: "add" | "subtract";
}

export interface SafeToSpendEstimate {
  /** Clamped to a minimum of 0. */
  amount: number;
  /** True when the clamp changed the result, i.e. the raw estimate was negative. */
  clamped: boolean;
  /** The value before clamping, useful for explaining a $0 result. */
  rawAmount: number;
  currentBalance: number;
  reservedUpcomingBills: number;
  expectedEssentialExpenses: number;
  minimumProtectedBalance: number;
  /** Days of upcoming obligations the estimate reserves for. */
  reservationWindowDays: number;
  breakdown: SafeToSpendLine[];
  /**
   * Phase 1 uses a transparent subtraction, not the Phase 2 Monte Carlo
   * optimizer. The UI relies on this to label the figure honestly.
   */
  method: "illustrative-placeholder";
}

export interface CategorySpend {
  category: TransactionCategory;
  total: number;
  /** Share of the period total, 0-100, rounded to one decimal place. */
  percentage: number;
  /** `0` when the summary is built from estimates rather than transactions. */
  transactionCount: number;
}

/**
 * `transactions` summaries measure settled history. `estimates` summaries are
 * built from the monthly amounts a user entered during onboarding, for a
 * profile that has no transaction history, and must be labelled as estimates.
 */
export type SpendingBasis = "transactions" | "estimates";

export interface SpendingSummary {
  accountId: string;
  basis: SpendingBasis;
  /** Inclusive ISO start date of the period. */
  periodStart: string;
  /** Inclusive ISO end date of the period. */
  periodEnd: string;
  periodDays: number;
  total: number;
  categories: CategorySpend[];
  topCategory: CategorySpend | null;
  transactionCount: number;
}

/** Status of the Phase 2 Monte Carlo engine, surfaced instead of a fake number. */
export type SimulationStatus = "unavailable";

export interface FinancialSummary {
  accountId: string;
  /** Demo reference date the whole summary was computed against. */
  referenceDate: string;
  currentBalance: number;
  protectedMinimumBalance: number;
  upcomingBillsTotal: number;
  upcomingBillsCount: number;
  /** Window used for `upcomingBillsTotal`. */
  upcomingWindowDays: number;
  expectedIncomeTotal: number;
  nextIncomeDate: string | null;
  nextIncomeAmount: number | null;
  safeToSpend: SafeToSpendEstimate;
  simulationStatus: SimulationStatus;
}

/**
 * Who the dashboard is for. Onboarding never asks for a name or email, so a
 * personal profile leaves them `null` and the UI addresses the user generically
 * rather than inventing an identity.
 */
export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  initials: string | null;
  accountType: AccountType;
  primaryAccountId: string;
}

export type TargetConfidence = 90 | 95 | 99;
export type ForecastHorizon = 30 | 60 | 90;
export type ThemePreference = "dark" | "light" | "system";

export interface UserPreferences {
  minimumProtectedBalance: number;
  /**
   * Stored for the Phase 2 simulator. It does not affect the Phase 1
   * illustrative estimate and the UI says so.
   */
  targetConfidence: TargetConfidence;
  forecastHorizonDays: ForecastHorizon;
  theme: ThemePreference;
}

/** A monthly spending estimate the user entered, mapped to a domain category. */
export interface SpendingEstimate {
  category: TransactionCategory;
  monthlyAmount: number;
}

/**
 * Everything the financial service computes from: the canonical inputs to the
 * cash-flow timeline.
 *
 * The demo profile resolves to the seeded mock dataset; a personal profile
 * resolves through `profileToDataset`. Both feed the same expansion, forecast
 * and safe-to-spend code, so there is exactly one forecasting system.
 */
export interface FinancialDataset {
  /**
   * Identifies the inputs. A personal profile's key is a fingerprint of its
   * answers, so any edit produces a new key and every cached result computed
   * from the old answers is discarded.
   */
  key: string;
  source: "demo" | "user_entered";
  /** The day forecasts start from; the balance is as of this day. */
  referenceDate: string;
  user: UserProfile;
  accounts: Account[];
  /** Settled history. Empty for a personal profile, which has none. */
  transactions: Transaction[];
  bills: Bill[];
  incomeSources: IncomeSource[];
  oneOffEvents: CashFlowEvent[];
  /**
   * Monthly estimates per category, for a dataset without transaction
   * history. `null` when spending is measured from `transactions`.
   */
  spendingEstimates: SpendingEstimate[] | null;
}

/** Shape of an insight derived from the mock transaction dataset. */
export interface DescriptiveInsight {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: "neutral" | "positive" | "caution";
}
