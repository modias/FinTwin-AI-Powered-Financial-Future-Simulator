"use client";

/**
 * TanStack Query bindings over `FinancialService`.
 *
 * Components never call the service directly — they call these hooks, which own
 * the query keys, the caching policy and the wiring to the active dataset,
 * account and preferences. When the FastAPI implementation lands, nothing in
 * this file has to change.
 *
 * Every key starts with the active dataset's key. A personal profile's key is
 * a fingerprint of its answers, so editing the profile — or switching between
 * the demo and a personal profile — moves every query to a fresh key, and
 * nothing computed from the previous inputs is ever shown for the new ones.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { SPENDING_PERIOD_DAYS } from "@/lib/constants";
import {
  getFinancialService,
  type FinancialService,
  type ForecastRequest,
  type SpendingRequest,
  type SummaryRequest,
  type TransactionQuery,
  type UpcomingEventsRequest,
} from "@/services/financial-service";
import type {
  Account,
  Bill,
  CashFlowEvent,
  FinancialSummary,
  ForecastSeries,
  IncomeSource,
  SpendingSummary,
  Transaction,
  UserProfile,
} from "@/types/financial";

export const financialKeys = {
  all: ["financial"] as const,
  dataset: (datasetKey: string) => [...financialKeys.all, datasetKey] as const,
  profile: (datasetKey: string) =>
    [...financialKeys.dataset(datasetKey), "profile"] as const,
  accounts: (datasetKey: string) =>
    [...financialKeys.dataset(datasetKey), "accounts"] as const,
  transactions: (datasetKey: string, query: TransactionQuery) =>
    [...financialKeys.dataset(datasetKey), "transactions", query] as const,
  bills: (datasetKey: string, accountId: string) =>
    [...financialKeys.dataset(datasetKey), "bills", accountId] as const,
  income: (datasetKey: string, accountId: string) =>
    [...financialKeys.dataset(datasetKey), "income", accountId] as const,
  events: (datasetKey: string, request: UpcomingEventsRequest) =>
    [...financialKeys.dataset(datasetKey), "events", request] as const,
  forecast: (datasetKey: string, request: ForecastRequest) =>
    [...financialKeys.dataset(datasetKey), "forecast", request] as const,
  summary: (datasetKey: string, request: SummaryRequest) =>
    [...financialKeys.dataset(datasetKey), "summary", request] as const,
  spending: (datasetKey: string, request: SpendingRequest) =>
    [...financialKeys.dataset(datasetKey), "spending", request] as const,
};

const NO_DATASET = "none";

/**
 * Keeps the previous result on screen while a new one loads — but only within
 * the same dataset. Across datasets the old result describes someone else's
 * finances (or the user's old answers), so a skeleton is shown instead.
 */
function keepPreviousWithin(datasetKey: string) {
  return <T,>(
    previous: T | undefined,
    previousQuery: { queryKey: readonly unknown[] } | undefined,
  ): T | undefined =>
    previousQuery?.queryKey[1] === datasetKey ? previous : undefined;
}

/** The service for the active dataset, or `null` before a profile exists. */
function useService(): { service: FinancialService | null; datasetKey: string } {
  const { dataset } = useWorkspace();

  return {
    service: dataset ? getFinancialService(dataset) : null,
    datasetKey: dataset?.key ?? NO_DATASET,
  };
}

function requireService(service: FinancialService | null): FinancialService {
  if (!service) throw new Error("No active financial profile");

  return service;
}

export function useUserProfile(): UseQueryResult<UserProfile> {
  const { service, datasetKey } = useService();

  return useQuery({
    queryKey: financialKeys.profile(datasetKey),
    queryFn: () => requireService(service).getUserProfile(),
    enabled: service !== null,
    staleTime: Infinity,
  });
}

export function useAccounts(): UseQueryResult<Account[]> {
  const { service, datasetKey } = useService();

  return useQuery({
    queryKey: financialKeys.accounts(datasetKey),
    queryFn: () => requireService(service).getAccounts(),
    enabled: service !== null,
    staleTime: Infinity,
  });
}

/** The account currently selected in the header, once accounts have loaded. */
export function useSelectedAccount(): Account | undefined {
  const { selectedAccountId } = useWorkspace();
  const { data: accounts } = useAccounts();

  return accounts?.find((account) => account.id === selectedAccountId);
}

export function useTransactions(
  query: TransactionQuery = {},
): UseQueryResult<Transaction[]> {
  const { service, datasetKey } = useService();

  return useQuery({
    queryKey: financialKeys.transactions(datasetKey, query),
    queryFn: () => requireService(service).getTransactions(query),
    enabled: service !== null,
    placeholderData: keepPreviousWithin(datasetKey),
  });
}

export function useBills(): UseQueryResult<Bill[]> {
  const { service, datasetKey } = useService();
  const { selectedAccountId } = useWorkspace();

  return useQuery({
    queryKey: financialKeys.bills(datasetKey, selectedAccountId ?? ""),
    queryFn: () => requireService(service).getBills(selectedAccountId ?? ""),
    enabled: service !== null && selectedAccountId !== null,
  });
}

export function useIncomeSources(): UseQueryResult<IncomeSource[]> {
  const { service, datasetKey } = useService();
  const { selectedAccountId } = useWorkspace();

  return useQuery({
    queryKey: financialKeys.income(datasetKey, selectedAccountId ?? ""),
    queryFn: () => requireService(service).getIncomeSources(selectedAccountId ?? ""),
    enabled: service !== null && selectedAccountId !== null,
  });
}

/**
 * Builds an account-scoped request, or `null` until a profile and account
 * are available.
 */
function useAccountScope(): { accountId: string; referenceDate: string } | null {
  const { selectedAccountId, referenceDate } = useWorkspace();

  return selectedAccountId && referenceDate
    ? { accountId: selectedAccountId, referenceDate }
    : null;
}

export function useUpcomingEvents(
  windowDays: number,
  limit?: number,
): UseQueryResult<CashFlowEvent[]> {
  const { service, datasetKey } = useService();
  const scope = useAccountScope();
  const request: UpcomingEventsRequest = {
    accountId: scope?.accountId ?? "",
    referenceDate: scope?.referenceDate ?? "",
    windowDays,
    limit,
  };

  return useQuery({
    queryKey: financialKeys.events(datasetKey, request),
    queryFn: () => requireService(service).getUpcomingCashFlowEvents(request),
    enabled: service !== null && scope !== null,
    placeholderData: keepPreviousWithin(datasetKey),
  });
}

/**
 * The illustrative forecast for the selected account.
 *
 * The horizon comes from preferences, which is why the chart's 30/60/90 toggle
 * and the Settings control stay in agreement: they write the same value.
 */
export function useForecast(): UseQueryResult<ForecastSeries> {
  const { service, datasetKey } = useService();
  const { preferences } = useWorkspace();
  const scope = useAccountScope();
  const request: ForecastRequest = {
    accountId: scope?.accountId ?? "",
    referenceDate: scope?.referenceDate ?? "",
    horizonDays: preferences.forecastHorizonDays,
    protectedBalance: preferences.minimumProtectedBalance,
  };

  return useQuery({
    queryKey: financialKeys.forecast(datasetKey, request),
    queryFn: () => requireService(service).getForecast(request),
    enabled: service !== null && scope !== null,
    placeholderData: keepPreviousWithin(datasetKey),
  });
}

export function useFinancialSummary(): UseQueryResult<FinancialSummary> {
  const { service, datasetKey } = useService();
  const { preferences } = useWorkspace();
  const scope = useAccountScope();
  const request: SummaryRequest = {
    accountId: scope?.accountId ?? "",
    referenceDate: scope?.referenceDate ?? "",
    protectedBalance: preferences.minimumProtectedBalance,
  };

  return useQuery({
    queryKey: financialKeys.summary(datasetKey, request),
    queryFn: () => requireService(service).getFinancialSummary(request),
    enabled: service !== null && scope !== null,
    placeholderData: keepPreviousWithin(datasetKey),
  });
}

export function useSpendingSummary(
  periodDays: number = SPENDING_PERIOD_DAYS,
): UseQueryResult<SpendingSummary> {
  const { service, datasetKey } = useService();
  const scope = useAccountScope();
  const request: SpendingRequest = {
    accountId: scope?.accountId ?? "",
    referenceDate: scope?.referenceDate ?? "",
    periodDays,
  };

  return useQuery({
    queryKey: financialKeys.spending(datasetKey, request),
    queryFn: () => requireService(service).getSpendingSummary(request),
    enabled: service !== null && scope !== null,
    placeholderData: keepPreviousWithin(datasetKey),
  });
}
