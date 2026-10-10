"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";

import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // The Phase 1 dataset is static, so refetching gains nothing. These
        // defaults are also sensible for the FastAPI backend that replaces it.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  // Created in state so React's strict-mode double render reuses one client.
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </WorkspaceProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
