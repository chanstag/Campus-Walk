import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { PageShell } from "./app/PageShell";
import { AcceptInvitePage } from "./auth/AcceptInvitePage";
import { LoginPage } from "./auth/LoginPage";
import { RequireAuth } from "./auth/RequireAuth";
import { CampusesPage } from "./campuses/CampusesPage";
import DesignPage from "./design/DesignPage";
import { initAccent } from "./hooks/use-accent";
import { initTheme } from "./hooks/use-theme";
import "./index.css";
import { queryClient, trpcClient } from "./offline/client";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE,
  makePersister,
  shouldPersistMutation,
  shouldPersistQuery,
} from "./offline/persist";
import { OfficePage } from "./office/OfficePage";
import { PermissionsPage } from "./permissions/PermissionsPage";
import { TRPCProvider } from "./trpc";
import { UsersPage } from "./users/UsersPage";
import { WalkPage } from "./walk/WalkPage";

initTheme();
initAccent();

/**
 * The walk screen's reads and any unsynced writes are kept in IndexedDB. On load the cache is
 * restored first, then queued writes replay (see `offline/outbox.ts`).
 */
const persistOptions = {
  persister: makePersister(),
  maxAge: CACHE_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery, shouldDehydrateMutation: shouldPersistMutation },
};

function Root() {
  return (
    <BrowserRouter>
      <NuqsAdapter>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
          onSuccess={() => queryClient.resumePausedMutations()}
        >
          <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invite/:token" element={<AcceptInvitePage />} />

              <Route element={<RequireAuth />}>
                <Route path="/" element={<Navigate to="/walk" replace />} />
              </Route>
              <Route element={<RequireAuth permission="campus:read" />}>
                <Route path="/walk" element={<WalkPage />} />
              </Route>
              <Route element={<RequireAuth permission="summary:read" />}>
                <Route path="/office" element={<OfficePage />} />
              </Route>
              <Route element={<RequireAuth permission="campus:update" />}>
                <Route path="/campuses" element={<CampusesPage />} />
              </Route>
              <Route element={<RequireAuth permission="user:read" />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route element={<RequireAuth permission="permission:read" />}>
                <Route path="/permissions" element={<PermissionsPage />} />
              </Route>

              {/* Dev-only style guide; the link is hidden in production builds. */}
              <Route
                path="/design"
                element={
                  <PageShell placeholder="Design system">
                    <DesignPage />
                  </PageShell>
                }
              />
            </Routes>
          </TRPCProvider>
        </PersistQueryClientProvider>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
