"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Server components hand the first payload over via HydrationBoundary;
        // a non-zero staleTime stops the client from refetching it on mount.
        staleTime: 1_000,
        // Stop polling on tab blur (handoff "Live state").
        refetchIntervalInBackground: false,
        retry: 1,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState, not a module singleton, so each request on the server gets its own client.
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
