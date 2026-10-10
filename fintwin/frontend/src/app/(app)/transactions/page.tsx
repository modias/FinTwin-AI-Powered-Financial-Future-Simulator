import type { Metadata } from "next";

import { TransactionHistory } from "./transaction-history";

// Rendered from the profile in this browser; see `(app)/layout.tsx`.
export const instant = false;

export const metadata: Metadata = {
  title: "Transaction History",
  description:
    "Search and filter your transaction history.",
};

export default function TransactionsPage() {
  return <TransactionHistory />;
}
