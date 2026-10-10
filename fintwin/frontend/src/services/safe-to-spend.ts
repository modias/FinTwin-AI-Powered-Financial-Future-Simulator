/**
 * Phase 1 safe-to-spend placeholder.
 *
 * ⚠️ This is a transparent subtraction, not a probabilistic result. It answers
 * "what is left after I set aside everything I already know about?" — it does
 * **not** estimate a probability of staying above the protected balance, and
 * the UI must never present it as one.
 *
 *     estimate = current balance
 *              − scheduled bills in the reservation window
 *              − estimated (non-bill) spending in the reservation window
 *              − minimum protected balance
 *
 * Two deliberate choices make the estimate conservative:
 *  - Upcoming income inside the window is ignored. The estimate never spends
 *    money that has not arrived.
 *  - The result is clamped at zero, because a negative "safe to spend" is not a
 *    meaningful instruction.
 *
 * Phase 2 replaces this entire module with the Monte Carlo optimiser. Keeping
 * it isolated means the swap touches one file: callers depend on
 * `estimateSafeToSpend` and the `SafeToSpendEstimate` shape, nothing else.
 */

import { roundMoney } from "@/lib/calculations";
import type { CashFlowEvent, SafeToSpendEstimate } from "@/types/financial";

export interface SafeToSpendInput {
  currentBalance: number;
  minimumProtectedBalance: number;
  /** Cash-flow events already filtered to the reservation window. */
  windowEvents: readonly CashFlowEvent[];
  reservationWindowDays: number;
}

export function estimateSafeToSpend({
  currentBalance,
  minimumProtectedBalance,
  windowEvents,
  reservationWindowDays,
}: SafeToSpendInput): SafeToSpendEstimate {
  let reservedUpcomingBills = 0;
  let expectedEssentialExpenses = 0;

  for (const event of windowEvents) {
    if (event.direction !== "expense") continue;

    if (event.confidence === "scheduled") {
      reservedUpcomingBills += event.amount;
    } else {
      expectedEssentialExpenses += event.amount;
    }
  }

  reservedUpcomingBills = roundMoney(reservedUpcomingBills);
  expectedEssentialExpenses = roundMoney(expectedEssentialExpenses);

  const rawAmount = roundMoney(
    currentBalance -
      reservedUpcomingBills -
      expectedEssentialExpenses -
      minimumProtectedBalance,
  );

  return {
    amount: Math.max(0, rawAmount),
    clamped: rawAmount < 0,
    rawAmount,
    currentBalance,
    reservedUpcomingBills,
    expectedEssentialExpenses,
    minimumProtectedBalance,
    reservationWindowDays,
    method: "illustrative-placeholder",
    breakdown: [
      {
        label: "Current balance",
        description: "Balance on the selected account on the day the forecast starts.",
        amount: currentBalance,
        effect: "add",
      },
      {
        label: "Reserved upcoming bills",
        description: `Scheduled bills due in the next ${reservationWindowDays} days.`,
        amount: reservedUpcomingBills,
        effect: "subtract",
      },
      {
        label: "Estimated spending",
        description: `Spending that isn’t a fixed bill, such as groceries and fuel, estimated over the next ${reservationWindowDays} days.`,
        amount: expectedEssentialExpenses,
        effect: "subtract",
      },
      {
        label: "Protected minimum balance",
        description: "The cushion you asked FinTwin never to dip into.",
        amount: minimumProtectedBalance,
        effect: "subtract",
      },
    ],
  };
}
