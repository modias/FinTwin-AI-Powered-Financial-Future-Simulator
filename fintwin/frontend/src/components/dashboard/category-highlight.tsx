"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { TransactionCategory } from "@/types/financial";

interface CategoryHighlight {
  category: TransactionCategory | null;
  setCategory: (category: TransactionCategory | null) => void;
}

const noHighlight: CategoryHighlight = { category: null, setCategory: () => {} };

const CategoryHighlightContext = createContext<CategoryHighlight>(noHighlight);

/** Lets a click on an upcoming event highlight its category in the spending chart. */
export function CategoryHighlightProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<TransactionCategory | null>(null);
  const value = useMemo(() => ({ category, setCategory }), [category]);

  return (
    <CategoryHighlightContext.Provider value={value}>{children}</CategoryHighlightContext.Provider>
  );
}

export function useCategoryHighlight(): CategoryHighlight {
  return useContext(CategoryHighlightContext);
}
