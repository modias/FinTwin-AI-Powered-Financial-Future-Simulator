/**
 * Display labels for profile values, and how each profile category maps onto
 * the domain categories the dashboard already understands.
 */

import { formatMediumDate } from "@/lib/dates";
import type { TransactionCategory } from "@/types/financial";
import type {
  BillCategory,
  BillFrequency,
  PayFrequency,
  ProfileBill,
  ProfileConfidence,
  VariableSpendingCategory,
} from "@/types/profile";

export const payFrequencyLabels: Record<PayFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice per month",
  monthly: "Monthly",
  irregular: "Irregularly",
  none: "No regular income",
};

export const payFrequencyDescriptions: Record<PayFrequency, string> = {
  weekly: "The same day every week.",
  biweekly: "Every other week, 26 paychecks a year.",
  semimonthly: "Two fixed dates, like the 1st and 15th.",
  monthly: "Once a month.",
  irregular: "Freelance, gig or commission income.",
  none: "No paycheck right now.",
};

export const billFrequencyLabels: Record<BillFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  semimonthly: "Twice per month",
  monthly: "Monthly",
  one_time: "One-time",
};

export const billCategoryLabels: Record<BillCategory, string> = {
  utilities: "Utilities",
  phone: "Phone",
  internet: "Internet",
  insurance: "Insurance",
  car_payment: "Car payment",
  student_loans: "Student loans",
  subscriptions: "Subscriptions",
  healthcare: "Healthcare",
  other: "Other",
};

export const variableSpendingLabels: Record<VariableSpendingCategory, string> = {
  groceries: "Groceries",
  transportation: "Transportation",
  dining: "Dining out",
  shopping: "Shopping",
  entertainment: "Entertainment",
  personal_care: "Personal care",
  other: "Other variable expenses",
};

export const variableSpendingHints: Record<VariableSpendingCategory, string> = {
  groceries: "Supermarkets and food for home.",
  transportation: "Fuel, transit, rideshares and parking.",
  dining: "Restaurants, takeout and coffee.",
  shopping: "Clothes, household items and online orders.",
  entertainment: "Movies, events, games and hobbies.",
  personal_care: "Haircuts, toiletries and similar.",
  other: "Anything else that varies month to month.",
};

export const confidenceLabels: Record<
  ProfileConfidence,
  { title: string; description: string }
> = {
  0.9: {
    title: "Flexible",
    description: "Aim for a 90% chance of staying above your minimum.",
  },
  0.95: {
    title: "Balanced",
    description: "Aim for a 95% chance of staying above your minimum.",
  },
  0.99: {
    title: "Very cautious",
    description: "Aim for a 99% chance of staying above your minimum.",
  },
};

export const billCategoryToDomain: Record<BillCategory, TransactionCategory> = {
  utilities: "Utilities",
  phone: "Utilities",
  internet: "Utilities",
  insurance: "Insurance",
  car_payment: "Transportation",
  student_loans: "Debt",
  subscriptions: "Subscriptions",
  healthcare: "Healthcare",
  other: "Other",
};

export const variableSpendingToDomain: Record<
  VariableSpendingCategory,
  TransactionCategory
> = {
  groceries: "Food",
  transportation: "Transportation",
  dining: "Food",
  shopping: "Shopping",
  entertainment: "Entertainment",
  personal_care: "Personal Care",
  other: "Other",
};

/** `Monthly on the 14th`, `Every two weeks · next Oct 14`, `Once on Nov 13, 2026`. */
export function describeBillSchedule(bill: ProfileBill): string {
  switch (bill.frequency) {
    case "weekly":
    case "biweekly":
      return `${billFrequencyLabels[bill.frequency]} · next ${formatMediumDate(bill.nextDueDate)}`;
    case "monthly":
      return `Monthly on the ${ordinal(bill.dueDay)}`;
    case "semimonthly":
      return `Twice a month, on the ${ordinal(bill.dueDays[0])} and ${ordinal(bill.dueDays[1])}`;
    case "one_time":
      return `Once on ${formatMediumDate(bill.nextDueDate)}`;
  }
}

export function ordinal(day: number): string {
  const lastTwo = day % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return `${day}th`;

  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}
