import { onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "api/src/router";
import { makeTRPCClient } from "@/trpc";
import { isUnauthorized } from "./errors";
import { registerOutbox } from "./outbox";
import { CACHE_MAX_AGE } from "./persist";

/**
 * One query client and tRPC client for the app, at module level so the outbox defaults (which
 * replay persisted writes before any component mounts) can use them. `main.tsx` hands both to the
 * providers.
 */
export const queryClient = new QueryClient({
  // A session that expires mid-visit shows up as UNAUTHORIZED on the next query; go sign in.
  // Queued writes are already in IndexedDB and replay after sign-in.
  queryCache: new QueryCache({
    onError: (err) => {
      if (isUnauthorized(err) && window.location.pathname !== "/login") window.location.assign("/login");
    },
  }),
  defaultOptions: {
    // Kept as long as the persisted cache is trusted, so cached rooms survive to be saved and restored.
    queries: { retry: (count, err) => !isUnauthorized(err) && count < 3, gcTime: CACHE_MAX_AGE },
  },
});

export const trpcClient = makeTRPCClient();

/** Same proxy `useTRPC()` returns, usable outside React. */
export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });

registerOutbox(queryClient, trpc, trpcClient);

// TanStack assumes "online" at startup and only listens for later online/offline events, so an app
// opened with no signal would try writes instead of queueing them. Start from the browser's view.
onlineManager.setOnline(navigator.onLine);
