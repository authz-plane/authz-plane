import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

/**
 * Render with a fresh QueryClient so component tests never share cache.
 * `seed` runs before render to pre-populate the cache (mirrors HydrationBoundary).
 */
export function renderWithQuery(
  ui: ReactElement,
  options?: RenderOptions & { seed?: (client: QueryClient) => void },
) {
  const { seed, ...renderOptions } = options ?? {};
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  seed?.(client);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
