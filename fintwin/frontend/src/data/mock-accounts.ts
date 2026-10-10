/**
 * Demonstration accounts.
 *
 * Both accounts are checking accounts with genuinely different balances,
 * obligations and cash-flow rhythms, so switching accounts in the header
 * changes every derived figure on the dashboard.
 */

import type { Account, UserProfile } from "@/types/financial";

export const PRIMARY_ACCOUNT_ID = "acc_everyday_checking";
export const SECONDARY_ACCOUNT_ID = "acc_freelance_checking";

export const mockAccounts: Account[] = [
  {
    id: PRIMARY_ACCOUNT_ID,
    name: "Everyday Checking",
    institution: "Northfield Bank",
    type: "checking",
    mask: "4821",
    currentBalance: 2143,
    currency: "USD",
    isPrimary: true,
  },
  {
    id: SECONDARY_ACCOUNT_ID,
    name: "Freelance Checking",
    institution: "Northfield Bank",
    type: "checking",
    mask: "7719",
    currentBalance: 4860.25,
    currency: "USD",
    isPrimary: false,
  },
];

export const mockUserProfile: UserProfile = {
  id: "usr_alex_morgan",
  name: "Alex Morgan",
  email: "alex.morgan@fintwin.demo",
  initials: "AM",
  accountType: "checking",
  primaryAccountId: PRIMARY_ACCOUNT_ID,
};
