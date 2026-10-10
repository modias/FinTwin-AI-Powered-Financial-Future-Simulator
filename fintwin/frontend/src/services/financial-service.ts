/**
 * The single interface every screen reads financial data through.
 *
 * Phase 1 ships one implementation, `dataset-financial-service`, which serves
 * whichever dataset is active: the seeded demo or a personal profile. Phase 2
 * adds an HTTP implementation backed by FastAPI; because the UI only ever
 * imports `getFinancialService()`, swapping it is a configuration change
 * (`NEXT_PUBLIC_DATA_MODE`) rather than a refactor.
 *
 * Every method is async and every request carries the parameters the backend
 * would need, even where the in-memory service could read them from a module,
 * so the call sites do not have to change when the data starts coming over
 * the wire.
 */

import { DATA_MODE } from "@/lib/constants";
import { createFinancialService } from "@/services/dataset-financial-service";
import type {
  Account,
  Bill,
  CashFlowEvent,
  FinancialDataset,
  FinancialSummary,
  ForecastSeries,
  IncomeSource,
  SpendingSummary,
  Transaction,
  TransactionCategory,
  UserProfile,
} from "@/types/financial";

export interface TransactionQuery {
  accountId?: string;
  /** Case-insensitive match against merchant, description and category. */
  search?: string;
  category?: TransactionCategory | "all";
  limit?: number;
}

export interface AccountScopedRequest {
  accountId: string;
  /** The dataset's reference date, which every forward-looking figure starts from. */
  referenceDate: string;
}

export interface ForecastRequest extends AccountScopedRequest {
  horizonDays: number;
  protectedBalance: number;
}

export interface SummaryRequest extends AccountScopedRequest {
  protectedBalance: number;
}

export interface SpendingRequest extends AccountScopedRequest {
  periodDays: number;
}

export interface UpcomingEventsRequest extends AccountScopedRequest {
  windowDays: number;
  limit?: number;
}

export interface FinancialService {
  readonly mode: "mock" | "api";
  /** Identifies the inputs this service computes from; part of every query key. */
  readonly datasetKey: string;

  getUserProfile(): Promise<UserProfile>;
  getAccounts(): Promise<Account[]>;
  getAccount(accountId: string): Promise<Account | null>;
  getTransactions(query?: TransactionQuery): Promise<Transaction[]>;
  getBills(accountId: string): Promise<Bill[]>;
  getIncomeSources(accountId: string): Promise<IncomeSource[]>;
  getUpcomingCashFlowEvents(
    request: UpcomingEventsRequest,
  ): Promise<CashFlowEvent[]>;
  getForecast(request: ForecastRequest): Promise<ForecastSeries>;
  getFinancialSummary(request: SummaryRequest): Promise<FinancialSummary>;
  getSpendingSummary(request: SpendingRequest): Promise<SpendingSummary>;
}

const services = new WeakMap<FinancialDataset, FinancialService>();

/**
 * Resolves the implementation for the active dataset.
 *
 * Phase 1 only has the in-memory service; `NEXT_PUBLIC_DATA_MODE=api` is
 * rejected loudly rather than silently falling back, so a misconfigured
 * environment is obvious instead of looking like working software backed by
 * fake numbers.
 */
export function getFinancialService(dataset: FinancialDataset): FinancialService {
  if (DATA_MODE === "api") {
    throw new Error(
      "NEXT_PUBLIC_DATA_MODE=api is not supported yet: the FastAPI backend arrives in a later phase. Use NEXT_PUBLIC_DATA_MODE=mock.",
    );
  }

  let service = services.get(dataset);

  if (!service) {
    service = createFinancialService(dataset);
    services.set(dataset, service);
  }

  return service;
}
