/**
 * `FinancialService` over an in-memory `FinancialDataset`.
 *
 * The demo profile and a personal profile both run through this one
 * implementation, with the same event expansion. Only the dataset differs.
 * Everything probabilistic — the forecast, safety and safe-to-spend — comes
 * from the Monte Carlo engine (`src/simulation`), not from here.
 *
 * It behaves like a network client — async, request-parameter driven, and it
 * validates its own output against the Zod schemas in development so neither
 * dataset can drift away from the contract the real backend will have to
 * meet. A small artificial latency exercises the loading skeletons in
 * development.
 */

import {
  expandCashFlowEvents,
  forwardWindow,
  summarizeSpending,
  summarizeSpendingEstimates,
  sumBy,
} from "@/lib/calculations";
import { UPCOMING_BILLS_WINDOW_DAYS } from "@/lib/constants";
import {
  accountSchema,
  financialSummarySchema,
  spendingSummarySchema,
  transactionSchema,
} from "@/lib/schemas";
import type {
  FinancialService,
  SpendingRequest,
  SummaryRequest,
  TransactionQuery,
  UpcomingEventsRequest,
} from "@/services/financial-service";
import type {
  Account,
  Bill,
  CashFlowEvent,
  FinancialDataset,
  FinancialSummary,
  IncomeSource,
  SpendingSummary,
  Transaction,
  UserProfile,
} from "@/types/financial";

/**
 * Enough delay to exercise the loading skeletons while developing, with no
 * artificial cost in production builds or tests.
 */
const SIMULATED_LATENCY_MS =
  process.env.NODE_ENV === "development" ? 120 : 0;

function delay<T>(value: T): Promise<T> {
  if (SIMULATED_LATENCY_MS === 0) {
    return Promise.resolve(value);
  }

  return new Promise((resolve) => {
    setTimeout(() => resolve(value), SIMULATED_LATENCY_MS);
  });
}

/**
 * Validates payloads outside production. The test suite validates both
 * datasets, so this stays off the critical path in production builds.
 */
function assertShape<T>(
  schema: { parse: (value: unknown) => unknown },
  value: T,
  label: string,
): T {
  if (process.env.NODE_ENV === "production") {
    return value;
  }

  try {
    schema.parse(value);
  } catch (error) {
    throw new Error(`Data for "${label}" does not match its schema`, {
      cause: error,
    });
  }

  return value;
}

function matchesQuery(transaction: Transaction, query: TransactionQuery): boolean {
  if (query.accountId && transaction.accountId !== query.accountId) {
    return false;
  }

  if (
    query.category &&
    query.category !== "all" &&
    transaction.category !== query.category
  ) {
    return false;
  }

  const search = query.search?.trim().toLowerCase();

  if (!search) {
    return true;
  }

  return (
    transaction.merchant.toLowerCase().includes(search) ||
    transaction.description.toLowerCase().includes(search) ||
    transaction.category.toLowerCase().includes(search)
  );
}

export function createFinancialService(dataset: FinancialDataset): FinancialService {
  function accountOrThrow(accountId: string): Account {
    const account = dataset.accounts.find((candidate) => candidate.id === accountId);

    if (!account) {
      throw new Error(`Unknown account: ${accountId}`);
    }

    return account;
  }

  function eventsForWindow(accountId: string, start: string, end: string): CashFlowEvent[] {
    return expandCashFlowEvents({
      accountId,
      start,
      end,
      bills: dataset.bills,
      incomeSources: dataset.incomeSources,
      oneOffEvents: dataset.oneOffEvents,
    });
  }

  return {
    mode: "mock",
    datasetKey: dataset.key,

    getUserProfile(): Promise<UserProfile> {
      return delay(dataset.user);
    },

    getAccounts(): Promise<Account[]> {
      return delay(
        dataset.accounts.map((account) => assertShape(accountSchema, account, "account")),
      );
    },

    getAccount(accountId: string): Promise<Account | null> {
      return delay(dataset.accounts.find((account) => account.id === accountId) ?? null);
    },

    getTransactions(query: TransactionQuery = {}): Promise<Transaction[]> {
      const matches = dataset.transactions.filter((transaction) =>
        matchesQuery(transaction, query),
      );

      const limited =
        typeof query.limit === "number" ? matches.slice(0, query.limit) : matches;

      return delay(
        limited.map((transaction) =>
          assertShape(transactionSchema, transaction, "transaction"),
        ),
      );
    },

    getBills(accountId: string): Promise<Bill[]> {
      return delay(dataset.bills.filter((bill) => bill.accountId === accountId));
    },

    getIncomeSources(accountId: string): Promise<IncomeSource[]> {
      return delay(
        dataset.incomeSources.filter((source) => source.accountId === accountId),
      );
    },

    getUpcomingCashFlowEvents({
      accountId,
      referenceDate,
      windowDays,
      limit,
    }: UpcomingEventsRequest): Promise<CashFlowEvent[]> {
      const { start, end } = forwardWindow(referenceDate, windowDays);
      const events = eventsForWindow(accountId, start, end);

      return delay(typeof limit === "number" ? events.slice(0, limit) : events);
    },

    getFinancialSummary({
      accountId,
      referenceDate,
      protectedBalance,
    }: SummaryRequest): Promise<FinancialSummary> {
      const account = accountOrThrow(accountId);
      const billsWindow = forwardWindow(referenceDate, UPCOMING_BILLS_WINDOW_DAYS);
      const billsWindowEvents = eventsForWindow(accountId, billsWindow.start, billsWindow.end);

      const upcomingBills = billsWindowEvents.filter(
        (event) => event.direction === "expense" && event.confidence === "scheduled",
      );
      const upcomingIncome = billsWindowEvents.filter(
        (event) => event.direction === "income",
      );

      const summary: FinancialSummary = {
        accountId,
        referenceDate,
        currentBalance: account.currentBalance,
        protectedMinimumBalance: protectedBalance,
        upcomingBillsTotal: sumBy(upcomingBills, (event) => event.amount),
        upcomingBillsCount: upcomingBills.length,
        upcomingWindowDays: UPCOMING_BILLS_WINDOW_DAYS,
        expectedIncomeTotal: sumBy(upcomingIncome, (event) => event.amount),
        nextIncomeDate: upcomingIncome[0]?.date ?? null,
        nextIncomeAmount: upcomingIncome[0]?.amount ?? null,
      };

      return delay(assertShape(financialSummarySchema, summary, "financialSummary"));
    },

    getSpendingSummary({
      accountId,
      referenceDate,
      periodDays,
    }: SpendingRequest): Promise<SpendingSummary> {
      const summary = dataset.spendingEstimates
        ? summarizeSpendingEstimates({
            accountId,
            estimates: dataset.spendingEstimates,
            referenceDate,
          })
        : summarizeSpending({
            accountId,
            transactions: dataset.transactions,
            periodEnd: referenceDate,
            periodDays,
          });

      return delay(assertShape(spendingSummarySchema, summary, "spendingSummary"));
    },
  };
}
