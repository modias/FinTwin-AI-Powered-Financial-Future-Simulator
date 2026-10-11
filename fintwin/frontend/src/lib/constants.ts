import type {
  ForecastHorizon,
  TargetConfidence,
  ThemePreference,
  UserPreferences,
} from "@/types/financial";

export const APP_NAME = "FinTwin";
export const APP_TAGLINE = "Your financial future, before it happens.";

/**
 * Every date in the demo dataset is derived from this anchor.
 *
 * A fixed reference date — rather than `new Date()` — keeps the mock forecast,
 * the upcoming-events timeline and the transaction history consistent with each
 * other, makes the numbers reproducible in tests and screenshots, and avoids
 * server/client time drift during hydration.
 *
 * Override it with `NEXT_PUBLIC_DEMO_REFERENCE_DATE` to move the demo forward
 * without touching the dataset.
 */
export const DEMO_REFERENCE_DATE =
  process.env.NEXT_PUBLIC_DEMO_REFERENCE_DATE ?? "2026-10-12";

export const TARGET_CONFIDENCES = [90, 95, 99] as const satisfies readonly TargetConfidence[];
export const FORECAST_HORIZONS = [30, 60, 90] as const satisfies readonly ForecastHorizon[];
export const THEME_PREFERENCES = [
  "dark",
  "light",
  "system",
] as const satisfies readonly ThemePreference[];

export const DEFAULT_THEME: ThemePreference = "light";

/** Window used by the "Upcoming Bills" summary card. */
export const UPCOMING_BILLS_WINDOW_DAYS = 30;

/** Trailing window used for the spending breakdown and insights. */
export const SPENDING_PERIOD_DAYS = 30;

export const DEFAULT_PREFERENCES: UserPreferences = {
  minimumProtectedBalance: 300,
  targetConfidence: 95,
  forecastHorizonDays: 90,
  theme: DEFAULT_THEME,
};

/**
 * `localStorage` keys. Each is versioned: a build that changes a stored shape
 * bumps the suffix, and values under an old key are ignored rather than
 * misread.
 */
export const STORAGE_KEYS = {
  theme: "fintwin.theme.v1",
  workspace: "fintwin.workspace.v2",
  profiles: "fintwin.profiles.v1",
  onboardingDraft: "fintwin.onboarding-draft.v1",
} as const;
/** Written by the Phase 1 build before profiles existed; read once to migrate the theme. */
export const LEGACY_PREFERENCES_STORAGE_KEY = "fintwin.preferences.v1";

/** Upper bound for any single amount typed during onboarding: $10,000,000. */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

/**
 * Unexpected expenses, when the user says yes to including them. Shown
 * verbatim on the onboarding screen so the assumption is never hidden.
 *
 * Three $600 surprises a year is a deliberately round planning figure, not a
 * statistic about the user. The profile timeline spreads it evenly as a
 * weekly allowance (the expected cost); the simulation instead draws random
 * surprises at this rate and size, and drops the allowance so they are never
 * counted twice.
 */
export const EMERGENCY_ASSUMPTIONS = {
  averageCostCents: 60_000,
  eventsPerYear: 3,
} as const;

export const DATA_MODE = (process.env.NEXT_PUBLIC_DATA_MODE ?? "mock") as
  | "mock"
  | "api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
